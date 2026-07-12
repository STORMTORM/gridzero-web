import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowRight, ChevronDown, ChevronUp, RefreshCw, Cpu, 
  Layers, Settings, Zap, HardDrive
} from "lucide-react";
import * as siteVisitApi from "../../api/siteVisitApi";
import ProjectTopbar from "../../components/ProjectTopbar";

// Custom type declarations matching the API schema
interface PanelItem {
  id: string;
  brand: string | null;
  panel_name: string | null;
  app_name: string | null;
  model_no: string | null;
  dcr: string | boolean | null;
  technology: string | null;
  cell_type: string | null;
  module_type: string | null;
  cell_design: string | null;
  length: number | null;
  breadth: number | null;
  height: number | null;
  rating: number | null;
  voc: number | null;
  vmp: number | null;
  isc: number | null;
  imp: number | null;
  tem_coefficient: number | null;
  product_warranty: number | null;
  power_output_warranty: number | null;
  pdf_link: string | null;
  brand_image: string | null;
  image: string | null;
}

interface InverterItem {
  id: string;
  brand: string | null;
  product_name: string | null;
  app_name: string | null;
  models: string | null;
  max_dc_input_power: number | null;
  rated_ac_output: number | null;
  max_ac_output_current: number | null;
  phase: string | null;
  type: string | null;
  no_of_mppt: number | null;
  no_of_strings_per_mppt: number | null;
  max_pv_input_current_per_string: number | null;
  max_dc_short_circuit_current: number | null;
  brand_image: string | null;
  image: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  warranty?: number | null;
  start_up_voltage?: number | null;
  mppt_min_voltage?: number | null;
  mppt_max_voltage?: number | null;
  "DC/AC"?: number | string | null;
}

interface PanelCalculation {
  total_roof_area: number;
  obstruction_area: number;
  remaining_area: number;
  effective_area: number;
  panel_rating: number;
  panel_area: number;
  panels_by_area: number;
  panels_by_rating: number;
  panels_by_load: number | null;
  sanctioned_load: number | null;
  final_panels: number;
  type: "rating" | "area" | "load";
  project_type?: string | null;
}

interface AccessoryBrandOptions {
  dc_cable: BrandOption[];
  ac_cable: BrandOption[];
  mc4: BrandOption[];
  earthing_kit: BrandOption[];
  dcdb: BrandOption[];
  acdb: BrandOption[];
}

type BrandOption = { name: string; logo_url?: string | null };

const MAX_SYSTEM_KWP = 50;
const EFFECTIVE_AREA_FACTOR = 0.70;
const ACCESSORIES_DRAFT_PREFIX = "@gridzero/accessories_draft/";

function capSystemKwp(kwp: number, maxKwp = MAX_SYSTEM_KWP): number {
  if (!Number.isFinite(kwp) || kwp <= 0) return kwp;
  return Math.min(Math.round(kwp * 100) / 100, maxKwp);
}

function normalizeDcrValue(value: PanelItem["dcr"]): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

function normalizeBrandOptions(raw: unknown): BrandOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): BrandOption | null => {
      if (typeof item === "string") return { name: item, logo_url: null };
      if (item && typeof item === "object") {
        const obj = item as { name?: unknown; brand?: unknown; logo_url?: unknown; brand_image?: unknown };
        const name = typeof obj.name === "string" ? obj.name : typeof obj.brand === "string" ? obj.brand : "";
        if (!name) return null;
        return {
          name,
          logo_url: typeof obj.logo_url === "string" ? obj.logo_url : typeof obj.brand_image === "string" ? obj.brand_image : null,
        };
      }
      return null;
    })
    .filter((item): item is BrandOption => !!item);
}

function panelAreaM2Of(panel: PanelItem, calc: PanelCalculation): number {
  const lenM = (Number(panel.length) || 0) / 1000;
  const widM = (Number(panel.breadth) || 0) / 1000;
  return lenM > 0 && widM > 0 ? lenM * widM : (calc.panel_area || 0);
}

function roofPanelSuggestion(calc: PanelCalculation, panel: PanelItem) {
  const total = Math.max(0, calc.total_roof_area);
  const obstruction = Math.max(0, calc.obstruction_area);
  const available = Math.max(0, calc.remaining_area);
  const effective = available * EFFECTIVE_AREA_FACTOR;
  const panelArea = panelAreaM2Of(panel, calc);
  const suggested = panelArea > 0 ? Math.floor(effective / panelArea) : 0;
  return { total, obstruction, available, effective, panelArea, suggested };
}

function computeDefaultStringCount(
  panelCount: number,
  inv: InverterItem | null,
  panel: PanelItem | null,
): number | null {
  if (!inv || !panel || !panelCount || panelCount < 1) return null;
  const vmp = Number(panel.vmp) || 1;
  const mpptMin = Number(inv.mppt_min_voltage) || 0;
  const startup = Number(inv.start_up_voltage ?? inv.mppt_min_voltage) || mpptMin;
  const mppt = Math.max(1, Math.floor(Number(inv.no_of_mppt) || 1));
  const stringsPerMppt = Math.max(1, Math.floor(Number(inv.no_of_strings_per_mppt) || 1));
  const hardwareMax = mppt * stringsPerMppt;

  const minPps = vmp ? Math.max(1, Math.ceil(mpptMin / vmp)) : 1;
  const a = vmp ? Math.max(1, Math.ceil(startup / vmp)) : 1;
  const b = a ? panelCount / a : 0;
  if (b < 1) return null;

  let nStrings = Math.max(1, Math.min(Math.floor(b), hardwareMax));
  const countsValid = (n: number): boolean => {
    const base = Math.floor(panelCount / n);
    const rem = panelCount % n;
    for (let i = 0; i < n; i++) {
      if (base + (i < rem ? 1 : 0) < minPps) return false;
    }
    return true;
  };
  while (nStrings > 1 && !countsValid(nStrings)) nStrings -= 1;
  return countsValid(nStrings) ? nStrings : null;
}

function stringCapBounds(
  panel: PanelItem | null,
  inv: InverterItem | null,
  panelCount: number,
): { min: number; max: number } | null {
  if (!panel || !inv || !panelCount || panelCount < 1) return null;
  const voc = Number(panel.voc) || 0;
  const vmp = Number(panel.vmp) || 0;
  const mpptMax = Number(inv.mppt_max_voltage) || 0;
  const startup = Number(inv.start_up_voltage ?? inv.mppt_min_voltage) || 0;
  const mppt = Math.max(1, Math.floor(Number(inv.no_of_mppt) || 1));
  const strPerMppt = Math.max(1, Math.floor(Number(inv.no_of_strings_per_mppt) || 1));
  const invStrings = mppt * strPerMppt;
  if (voc <= 0 || vmp <= 0 || mpptMax <= 0 || startup <= 0) return null;
  const min = Math.max(1, Math.ceil((voc * 1.10 * panelCount) / mpptMax));
  const max = Math.max(1, Math.min(Math.floor((vmp * panelCount) / startup), invStrings));
  return { min, max: Math.max(min, max) };
}

// SLD / Electrical sizing utility (matching sldDefaults.ts / visit/sld.py)
const STANDARD_AC_MCB = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100];
const STANDARD_DC_MCB = [0.5, 1, 2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
const STANDARD_DC_FUSE = [1, 2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 32, 35, 40, 50, 63, 80, 100];

function nextFromTable(value: number, table: number[]): number {
  for (const rating of table) {
    if (rating >= value) return rating;
  }
  return table[table.length - 1];
}

function dcCableSizeFor(isc: number): number {
  if (isc <= 10) return 4;
  if (isc <= 15) return 6;
  if (isc <= 25) return 10;
  return 16;
}

function acCableSizeFor(acCurrent: number): number {
  if (acCurrent <= 25) return 4;
  if (acCurrent <= 40) return 6;
  if (acCurrent <= 60) return 10;
  return 16;
}

function sldDefaultsFor(isc: number, acCurrent: number) {
  return {
    dcCableSize: dcCableSizeFor(isc),
    acCableSize: acCableSizeFor(acCurrent),
    dcMcbRating: nextFromTable(isc * 1.5, STANDARD_DC_MCB),
    dcFuseRating: nextFromTable(isc * 1.25, STANDARD_DC_FUSE),
    acMcbRating: nextFromTable(acCurrent * 1.5, STANDARD_AC_MCB),
  };
}

export default function EquipmentSelection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const proposalOnlyParam = searchParams.get("proposal_only");
  const [isProposalOnly, setIsProposalOnly] = useState(false);

  // Navigation Steps: panel, capacity, inverter, accessories
  const [activeStep, setActiveStep] = useState<"panel" | "capacity" | "inverter" | "accessories">("panel");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Loaded items
  const [selectedPanel, setSelectedPanel] = useState<PanelItem | null>(null);
  const [projectName, setProjectName] = useState("");
  const [selectedInverter, setSelectedInverter] = useState<InverterItem | null>(null);
  const [panelCalculation, setPanelCalculation] = useState<PanelCalculation | null>(null);
  const [accessoriesCompleted, setAccessoriesCompleted] = useState(false);
  
  // Lists
  const [panelBrands, setPanelBrands] = useState<{ brand: string; brand_image: string | null }[]>([]);
  const [panelItems, setPanelItems] = useState<PanelItem[]>([]);
  const [inverterBrands, setInverterBrands] = useState<BrandOption[]>([]);
  const [inverters, setInverters] = useState<InverterItem[]>([]);
  const [accessoryBrandOptions, setAccessoryBrandOptions] = useState<AccessoryBrandOptions>({
    dc_cable: [],
    ac_cable: [],
    mc4: [],
    earthing_kit: [],
    dcdb: [],
    acdb: [],
  });

  // State loading indicators
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingPanels, setLoadingPanels] = useState(false);
  const [loadingInverters, setLoadingInverters] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [capacityConfirmed, setCapacityConfirmed] = useState(false);

  // Filters: Panels
  const [panelBrandSearch, setPanelBrandSearch] = useState("");
  const [panelSearch, setPanelSearch] = useState("");
  const [selectedPanelBrand, setSelectedPanelBrand] = useState<string | null>(null);
  const [panelTechFilter, setPanelTechFilter] = useState<string>("all");
  const [expandedPanelId, setExpandedPanelId] = useState<string | null>(null);
  const [panelPage, setPanelPage] = useState(1);
  const [panelHasMore, setPanelHasMore] = useState(false);

  // Filters: Capacity
  const [selectedPowerKwp, setSelectedPowerKwp] = useState<number>(0);
  const [selectedPanelCount, setSelectedPanelCount] = useState<number>(0);

  // Filters: Inverters
  const [inverterBrandSearch, setInverterBrandSearch] = useState("");
  const [selectedInverterBrand, setSelectedInverterBrand] = useState<string | null>(null);
  const [inverterPhaseFilter, setInverterPhaseFilter] = useState<string>("all");
  const [inverterSearch, setInverterSearch] = useState("");
  const [expandedInverterId, setExpandedInverterId] = useState<string | null>(null);
  const [inverterPage, setInverterPage] = useState(1);

  // States: Accessories
  const [dcCableSize, setDcCableSize] = useState("4");
  const [dcCableLength, setDcCableLength] = useState("50");
  const [acCableSize, setAcCableSize] = useState("4");
  const [acCableLength, setAcCableLength] = useState("50");
  const [stringCount, setStringCount] = useState("");
  const [dcFuseRating, setDcFuseRating] = useState("15");
  const [dcMcbRating, setDcMcbRating] = useState("32");
  const [acMcbRating, setAcMcbRating] = useState("32");

  const isStepLocked = (stepKey: "panel" | "capacity" | "inverter" | "accessories") => {
    if (stepKey === "panel") return false;
    if (stepKey === "capacity") return !selectedPanel;
    if (stepKey === "inverter") return !selectedPanel || !capacityConfirmed || selectedPowerKwp <= 0;
    if (stepKey === "accessories") return !selectedPanel || !capacityConfirmed || selectedPowerKwp <= 0 || !selectedInverter;
    return false;
  };

  const initialLoadStartedRef = useRef<string | null>(null);
  const lastFetchedParamsRef = useRef<string>("");
  const lastFetchedInverterParamsRef = useRef<string>("");
  const [mc4Connectors, setMc4Connectors] = useState("12");
  const [earthingKit, setEarthingKit] = useState("3");
  const [dcCableBrand, setDcCableBrand] = useState("");
  const [acCableBrand, setAcCableBrand] = useState("");
  const [mc4Brand, setMc4Brand] = useState("");
  const [earthingKitBrand, setEarthingKitBrand] = useState("");
  const [dcdbBrand, setDcdbBrand] = useState("");
  const [acdbBrand, setAcdbBrand] = useState("");
  const [structureType, setStructureType] = useState("Fixed Mounting Structure");
  const [structureMaterial, setStructureMaterial] = useState("HDGI");
  const [batteryEnabled, setBatteryEnabled] = useState(false);
  const [batteryKwh, setBatteryKwh] = useState("");

  const draftKey = id ? `${ACCESSORIES_DRAFT_PREFIX}${id}` : "";

  const roofSuggestion = useMemo(
    () => (panelCalculation && selectedPanel ? roofPanelSuggestion(panelCalculation, selectedPanel) : null),
    [panelCalculation, selectedPanel]
  );

  const derivedPanelCount = useMemo(() => {
    const rating = selectedPanel?.rating || panelCalculation?.panel_rating || 550;
    if (rating <= 0 || selectedPowerKwp <= 0) return 0;
    return Math.max(1, Math.floor((selectedPowerKwp * 1000) / rating));
  }, [selectedPowerKwp, selectedPanel, panelCalculation]);

  const powerLimitError = useMemo(() => {
    if (!selectedPanel && !panelCalculation) return null;
    if (selectedPowerKwp <= 0) return "Enter valid DC capacity.";
    if (selectedPowerKwp > MAX_SYSTEM_KWP + 0.001) return `Maximum allowed capacity is ${MAX_SYSTEM_KWP} kWp.`;
    return null;
  }, [selectedPowerKwp, selectedPanel, panelCalculation]);

  const stringBounds = useMemo(
    () => stringCapBounds(selectedPanel, selectedInverter, selectedPanelCount || derivedPanelCount),
    [selectedPanel, selectedInverter, selectedPanelCount, derivedPanelCount]
  );

  const stringsOutOfRange = useMemo(() => {
    if (!stringBounds) return false;
    if (!stringCount.trim()) return true;
    const n = parseInt(stringCount, 10);
    return !Number.isFinite(n) || n < stringBounds.min || n > stringBounds.max;
  }, [stringBounds, stringCount]);

  const numericError = (value: string, message: string): string | null => {
    const n = parseFloat(value);
    return value.trim() === "" || !Number.isFinite(n) || n <= 0 ? message : null;
  };

  const batteryInvalid = useMemo(() => {
    if (!batteryEnabled) return false;
    return !!numericError(batteryKwh, "Please enter a valid battery capacity.");
  }, [batteryEnabled, batteryKwh]);

  const accessoryErrors = useMemo(() => [
    numericError(dcCableSize, "Enter valid DC cable size."),
    numericError(dcCableLength, "Enter valid DC cable length."),
    numericError(acCableSize, "Enter valid AC cable size."),
    numericError(acCableLength, "Enter valid AC cable length."),
    numericError(mc4Connectors, "Enter valid number of MC4 connectors."),
    numericError(earthingKit, "Enter valid number of Earthing Kit & LA."),
  ].filter((msg): msg is string => !!msg), [dcCableSize, dcCableLength, acCableSize, acCableLength, mc4Connectors, earthingKit]);

  const firstAccessoryError = accessoryErrors[0] || null;
  const canFinish = !!selectedPanel && capacityConfirmed && selectedPowerKwp > 0 && !!selectedInverter && !powerLimitError && !stringsOutOfRange && !batteryInvalid && !firstAccessoryError;

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Initial data loading
  useEffect(() => {
    if (!id || initialLoadStartedRef.current === id) return;
    initialLoadStartedRef.current = id;
    (async () => {
      setInitialLoading(true);
      try {
        // 1. Fetch info and favourite brands
        const [infoData, brandsData, accBrandsData] = await Promise.all([
          siteVisitApi.getSelectionInfo(id),
          siteVisitApi.getPanelBrands().catch(() => null),
          siteVisitApi.getAccessoryBrands().catch(() => null),
        ]);

        const d = infoData;
        if (d?.sitevisit?.project_name) {
          setProjectName(d.sitevisit.project_name);
        } else if (d?.sitevisit?.name) {
          setProjectName(d.sitevisit.name);
        }
        const dbProposalOnly = !!d?.sitevisit?.proposal_only;
        const queryProposalOnly = proposalOnlyParam === "1" || proposalOnlyParam === "true";
        setIsProposalOnly(dbProposalOnly || queryProposalOnly);

        if (d?.panel) {
          setSelectedPanel(d.panel);
          setSelectedPanelBrand(d.panel.brand);
        }
        if (d?.panel_calculation) {
          const calc = d.panel_calculation as PanelCalculation;
          setPanelCalculation(calc);
          const savedCount = Number(d?.sitevisit?.panel_count);
          const panelCount = Number.isFinite(savedCount) && savedCount > 0 ? savedCount : calc.final_panels || 0;
          setSelectedPanelCount(panelCount);
          const savedPower = Number(d?.sitevisit?.capacity);
          const hasSavedPower = Number.isFinite(savedPower) && savedPower > 0;
          const powerKwp = hasSavedPower ? capSystemKwp(savedPower) : 0;
          setSelectedPowerKwp(powerKwp);
          setCapacityConfirmed(hasSavedPower);
        }
        if (d?.inverter) {
          setSelectedInverter(d.inverter);
          setSelectedInverterBrand(d.inverter.brand);
          setCapacityConfirmed(true);
          if (d.inverter.phase) {
            setInverterPhaseFilter(d.inverter.phase.toLowerCase().includes("three") ? "three" : "single");
          }
        }

        if (brandsData?.brands) {
          setPanelBrands(brandsData.brands);
        }

        if (accBrandsData) {
          const opts = accBrandsData;
          setAccessoryBrandOptions({
            dc_cable: normalizeBrandOptions(opts.dc_cable),
            ac_cable: normalizeBrandOptions(opts.ac_cable),
            mc4: normalizeBrandOptions(opts.mc4),
            earthing_kit: normalizeBrandOptions(opts.earthing_kit),
            dcdb: normalizeBrandOptions(opts.dcdb),
            acdb: normalizeBrandOptions(opts.acdb),
          });
        }

        // Load accessories draft from LocalStorage
        const cachedDraft = localStorage.getItem(`${ACCESSORIES_DRAFT_PREFIX}${id}`) ?? localStorage.getItem(`@accessories_draft_${id}`);
        if (cachedDraft) {
          try {
            const draft = JSON.parse(cachedDraft);
            if (draft.dc_cable_size) setDcCableSize(draft.dc_cable_size);
            if (draft.dc_cable_length) setDcCableLength(draft.dc_cable_length);
            if (draft.ac_cable_size) setAcCableSize(draft.ac_cable_size);
            if (draft.ac_cable_length) setAcCableLength(draft.ac_cable_length);
            if (draft.string_count) setStringCount(draft.string_count);
            if (draft.dc_fuse_rating) setDcFuseRating(draft.dc_fuse_rating);
            if (draft.dc_mcb_rating) setDcMcbRating(draft.dc_mcb_rating);
            if (draft.ac_mcb_rating) setAcMcbRating(draft.ac_mcb_rating);
            if (draft.mc4_connectors) setMc4Connectors(draft.mc4_connectors);
            if (draft.earthing_kit_pcs) setEarthingKit(draft.earthing_kit_pcs);
            if (draft.dc_cable_brand) setDcCableBrand(draft.dc_cable_brand);
            if (draft.ac_cable_brand) setAcCableBrand(draft.ac_cable_brand);
            if (draft.mc4_brand) setMc4Brand(draft.mc4_brand);
            if (draft.earthing_kit_brand) setEarthingKitBrand(draft.earthing_kit_brand);
            if (draft.dcdb_brand) setDcdbBrand(draft.dcdb_brand);
            if (draft.acdb_brand) setAcdbBrand(draft.acdb_brand);
            if (draft.structure_type) setStructureType(draft.structure_type);
            if (draft.structure_material) setStructureMaterial(draft.structure_material);
            if (draft.battery_enabled !== undefined) setBatteryEnabled(draft.battery_enabled);
            if (draft.battery_kwh) setBatteryKwh(draft.battery_kwh);
            setAccessoriesCompleted(true);
          } catch { /* ignore cache parse error */ }
        }
      } catch (err) {
        console.error(err);
        showToast("Failed to load design specifications.");
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [id, proposalOnlyParam]);

  // Load panels list based on brand search & filters
  useEffect(() => {
    if (initialLoading) return;
    const paramsStr = JSON.stringify({
      selectedPanelBrand,
      panelTechFilter,
      panelSearch,
      panelPage,
    });
    if (lastFetchedParamsRef.current === paramsStr) return;
    lastFetchedParamsRef.current = paramsStr;

    (async () => {
      setLoadingPanels(true);
      try {
        const res = await siteVisitApi.getPanels({
          brands: selectedPanelBrand || undefined,
          technology: panelTechFilter === "all" ? undefined : panelTechFilter,
          search: panelSearch || undefined,
          page: panelPage,
          limit: 6,
        });
        const items = Array.isArray(res?.data) ? res.data : [];
        setPanelItems(items);
        setPanelHasMore(items.length === (res?.limit ?? 6));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPanels(false);
      }
    })();
  }, [initialLoading, selectedPanelBrand, panelTechFilter, panelSearch, panelPage]);

  // Reset panels page on filters change
  useEffect(() => {
    setPanelPage(1);
  }, [selectedPanelBrand, panelTechFilter, panelSearch]);

  // Keep panel count in sync with typed/slider capacity. Installed capacity stays <= entered capacity.
  useEffect(() => {
    setSelectedPanelCount(derivedPanelCount);
  }, [derivedPanelCount]);

  // Load inverters and brand filters based on confirmed target capacity
  useEffect(() => {
    if (initialLoading || !id || !capacityConfirmed || !selectedPowerKwp || !panelCalculation || !selectedPanel) return;
    const paramsStr = JSON.stringify({
      selectedPowerKwp,
      selectedPanelId: selectedPanel.id,
      selectedPanelCount,
      calcType: panelCalculation.type,
      selectedInverterBrand,
      inverterPhaseFilter,
    });
    if (lastFetchedInverterParamsRef.current === paramsStr) return;
    lastFetchedInverterParamsRef.current = paramsStr;

    (async () => {
      setLoadingInverters(true);
      try {
        // Fetch inverter brands matching criteria
        const optData = await siteVisitApi.getInverterFilterOptions(id, {
          panel_count: selectedPanelCount,
          capacity: selectedPowerKwp,
          calc_type: panelCalculation.type,
          panel_id: selectedPanel.id,
        });
        setInverterBrands(normalizeBrandOptions(optData?.brands));

        // Fetch inverters matching criteria
        const res = await siteVisitApi.getInverter(id, {
          panel_count: selectedPanelCount,
          capacity: selectedPowerKwp,
          calc_type: panelCalculation.type,
          panel_id: selectedPanel.id,
          brands: selectedInverterBrand ? [selectedInverterBrand] : undefined,
          phase: inverterPhaseFilter === "all" ? undefined : inverterPhaseFilter,
        });
        if (res?.inverters) {
          setInverters(res.inverters);
        } else {
          setInverters([]);
        }
      } catch (err) {
        console.error(err);
        setInverterBrands([]);
        setInverters([]);
      } finally {
        setLoadingInverters(false);
      }
    })();
  }, [initialLoading, id, capacityConfirmed, selectedPowerKwp, selectedPanel, selectedPanelCount, panelCalculation, selectedInverterBrand, inverterPhaseFilter]);

  // Dynamically update electric defaults once panel + inverter are chosen. Existing typed values stay intact.
  useEffect(() => {
    if (selectedPanel && selectedInverter) {
      const isc = Number(selectedPanel.isc) || 0;
      const acCurrent = Number(selectedInverter.max_ac_output_current) || 0;
      const def = sldDefaultsFor(isc, acCurrent);
      setDcCableSize((cur) => cur.trim() ? cur : String(def.dcCableSize));
      setAcCableSize((cur) => cur.trim() ? cur : String(def.acCableSize));
      setDcMcbRating((cur) => cur.trim() ? cur : String(def.dcMcbRating));
      setDcFuseRating((cur) => cur.trim() ? cur : String(def.dcFuseRating));
      setAcMcbRating((cur) => cur.trim() ? cur : String(def.acMcbRating));
    }
  }, [selectedPanel, selectedInverter]);

  useEffect(() => {
    if (selectedPanelCount > 0) {
      setMc4Connectors((cur) => cur.trim() ? cur : String(2 * selectedPanelCount));
    }
  }, [selectedPanelCount]);

  useEffect(() => {
    const def = computeDefaultStringCount(selectedPanelCount, selectedInverter, selectedPanel);
    const clamp = (n: number) => stringBounds ? Math.min(stringBounds.max, Math.max(stringBounds.min, n)) : n;
    setStringCount((cur) => {
      if (cur.trim()) return cur;
      const base = def ?? stringBounds?.min ?? null;
      return base != null ? String(clamp(base)) : cur;
    });
  }, [selectedPanel, selectedInverter, selectedPanelCount, stringBounds]);

  useEffect(() => {
    if (!draftKey) return;
    const draft = {
      dc_cable_size: dcCableSize.trim(),
      dc_cable_length: dcCableLength.trim(),
      ac_cable_size: acCableSize.trim(),
      ac_cable_length: acCableLength.trim(),
      string_count: stringCount.trim(),
      dc_fuse_rating: dcFuseRating.trim(),
      dc_mcb_rating: dcMcbRating.trim(),
      ac_mcb_rating: acMcbRating.trim(),
      mc4_connectors: mc4Connectors.trim(),
      earthing_kit_pcs: earthingKit.trim(),
      dc_cable_brand: dcCableBrand.trim(),
      ac_cable_brand: acCableBrand.trim(),
      mc4_brand: mc4Brand.trim(),
      earthing_kit_brand: earthingKitBrand.trim(),
      dcdb_brand: dcdbBrand.trim(),
      acdb_brand: acdbBrand.trim(),
      structure_type: structureType.trim(),
      structure_material: structureMaterial.trim(),
      battery_enabled: batteryEnabled,
      battery_kwh: batteryEnabled ? batteryKwh.trim() : "",
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftKey, dcCableSize, dcCableLength, acCableSize, acCableLength, stringCount, dcFuseRating, dcMcbRating, acMcbRating, mc4Connectors, earthingKit, dcCableBrand, acCableBrand, mc4Brand, earthingKitBrand, dcdbBrand, acdbBrand, structureType, structureMaterial, batteryEnabled, batteryKwh]);

  // Handle panel selection save
  const handleSelectPanel = async (panel: PanelItem) => {
    if (!id) return;
    try {
      const data = await siteVisitApi.selectPanel(id, panel.id);
      const calc = data as PanelCalculation;
      const ratingKw = (calc.panel_rating || panel.rating || 550) / 1000;
      const autoKwp = capSystemKwp(roofPanelSuggestion(calc, panel).suggested * ratingKw);

      setSelectedPanel(panel);
      setSelectedPanelBrand(panel.brand);
      setPanelCalculation(calc);
      setSelectedPowerKwp(autoKwp);
      setSelectedPanelCount(autoKwp > 0 ? Math.max(1, Math.floor((autoKwp * 1000) / (calc.panel_rating || panel.rating || 550))) : 0);
      setCapacityConfirmed(false);
      setSelectedInverter(null);
      setSelectedInverterBrand(null);
      setInverters([]);
      setInverterBrands([]);
      setStringCount("");
      setActiveStep("capacity");
    } catch {
      showToast("Could not register panel selection.");
    }
  };

  // Handle inverter selection save
  const handleSelectInverter = async (inverter: InverterItem) => {
    if (!id) return;
    try {
      await siteVisitApi.selectInverter(id, inverter.id);
      setSelectedInverter(inverter);
      setSelectedInverterBrand(inverter.brand);
      setActiveStep("accessories");
    } catch {
      showToast("Could not register inverter selection.");
    }
  };

  // Handle capacity settings save
  const handleSaveCapacity = async () => {
    if (!id || !selectedPanel || !panelCalculation) return;
    if (powerLimitError) {
      showToast(powerLimitError);
      return;
    }
    if (!derivedPanelCount || derivedPanelCount <= 0) {
      showToast("Enter valid DC capacity.");
      return;
    }
    setSavingStep(true);
    try {
      setSelectedInverter(null);
      setSelectedInverterBrand(null);
      const data = await siteVisitApi.getInverter(id, {
        panel_count: derivedPanelCount,
        capacity: selectedPowerKwp,
        calc_type: panelCalculation.type,
        panel_id: selectedPanel.id,
      });
      setInverters(Array.isArray(data?.inverters) ? data.inverters : []);
      setCapacityConfirmed(true);
      lastFetchedInverterParamsRef.current = "";

      setActiveStep("inverter");
    } catch {
      showToast("Could not load compatible inverters.");
    } finally {
      setSavingStep(false);
    }
  };

  // Save final Accessories details & submit to API
  const handleFinishSelection = async () => {
    if (!id || !selectedPanel || !selectedInverter || !capacityConfirmed) {
      showToast("Complete previous selections before continuing.");
      return;
    }
    if (powerLimitError) {
      showToast(powerLimitError);
      return;
    }
    if (stringsOutOfRange && stringBounds) {
      showToast(`Number of strings must be between ${stringBounds.min} and ${stringBounds.max}.`);
      return;
    }
    if (firstAccessoryError) {
      showToast(firstAccessoryError);
      return;
    }
    if (batteryInvalid) {
      showToast("Please enter a valid battery capacity.");
      return;
    }
    setSavingStep(true);
    try {
      const parsedStrings = parseInt(stringCount, 10);
      const draft = {
        dc_cable_size: dcCableSize.trim(),
        dc_cable_length: dcCableLength.trim(),
        ac_cable_size: acCableSize.trim(),
        ac_cable_length: acCableLength.trim(),
        string_count: stringCount.trim(),
        dc_fuse_rating: dcFuseRating.trim(),
        dc_mcb_rating: dcMcbRating.trim(),
        ac_mcb_rating: acMcbRating.trim(),
        mc4_connectors: mc4Connectors.trim(),
        earthing_kit_pcs: earthingKit.trim(),
        dc_cable_brand: dcCableBrand.trim(),
        ac_cable_brand: acCableBrand.trim(),
        mc4_brand: mc4Brand.trim(),
        earthing_kit_brand: earthingKitBrand.trim(),
        dcdb_brand: dcdbBrand.trim(),
        acdb_brand: acdbBrand.trim(),
        structure_type: structureType.trim(),
        structure_material: structureMaterial.trim(),
        battery_enabled: batteryEnabled,
        battery_kwh: batteryEnabled ? batteryKwh.trim() : "",
      };
      
      // Store in Cache
      localStorage.setItem(`${ACCESSORIES_DRAFT_PREFIX}${id}`, JSON.stringify(draft));

      // 1. Post final equipment settings (proposal-only visits only)
      if (isProposalOnly) {
        await siteVisitApi.saveEquipmentProposal({
          sitevisit_id: id,
          panel_id: selectedPanel.id,
          inverter_id: selectedInverter.id,
          capacity_kw: selectedPowerKwp,
          ...(Number.isFinite(parsedStrings) && parsedStrings >= 1 ? { string_count: parsedStrings } : {}),
        });
      }

      // 2. Post electrical parameters
      await siteVisitApi.saveSldParams(id, {
        dc_cable_size: parseFloat(dcCableSize) || 4,
        ac_cable_size: parseFloat(acCableSize) || 4,
        dc_mcb_rating: parseFloat(dcMcbRating) || 32,
        dc_fuse_rating: parseFloat(dcFuseRating) || 15,
        ac_mcb_rating: parseFloat(acMcbRating) || 32,
        dc_cable_length: parseFloat(dcCableLength) || 50,
        ac_cable_length: parseFloat(acCableLength) || 50,
        ...(Number.isFinite(parsedStrings) && parsedStrings >= 1 ? { string_count: parsedStrings } : {}),
      });

      setAccessoriesCompleted(true);
      showToast("Design configuration saved successfully!");
      setTimeout(() => navigate(`/project/${id}/design?stage=placement`), 1000);
    } catch (err) {
      console.error(err);
      showToast("An error occurred while saving specifications.");
    } finally {
      setSavingStep(false);
    }
  };

  // Filtered panel brands list based on brand search input
  const filteredPanelBrands = useMemo(() => {
    const list = Array.isArray(panelBrands) ? panelBrands : [];
    if (!panelBrandSearch.trim()) return list;
    return list.filter(b => b.brand ? b.brand.toLowerCase().includes(panelBrandSearch.toLowerCase()) : false);
  }, [panelBrands, panelBrandSearch]);

  // Filtered list of inverters based on phase, brand and model search input
  const filteredInverters = useMemo(() => {
    let result = inverters;
    if (selectedInverterBrand) {
      result = result.filter(inv => inv.brand === selectedInverterBrand);
    }
    if (inverterPhaseFilter !== "all") {
      result = result.filter(inv => {
        const invPhase = inv.phase?.toLowerCase() || "";
        return inverterPhaseFilter === "single" ? invPhase.includes("single") : invPhase.includes("three");
      });
    }
    if (inverterSearch.trim()) {
      const q = inverterSearch.toLowerCase();
      result = result.filter(inv => {
        const brandMatch = inv.brand ? inv.brand.toLowerCase().includes(q) : false;
        const nameMatch = (inv.app_name || inv.product_name) 
          ? String(inv.app_name || inv.product_name).toLowerCase().includes(q) 
          : false;
        return brandMatch || nameMatch;
      });
    }
    return result;
  }, [inverters, selectedInverterBrand, inverterPhaseFilter, inverterSearch]);

  const inverterItemsPerPage = 6;
  const inverterTotalPages = Math.ceil(filteredInverters.length / inverterItemsPerPage) || 1;
  const paginatedInverters = useMemo(() => {
    const start = (inverterPage - 1) * inverterItemsPerPage;
    return filteredInverters.slice(start, start + inverterItemsPerPage);
  }, [filteredInverters, inverterPage]);

  const inverterHasMore = inverterPage < inverterTotalPages;

  // Reset inverter page on filters change
  useEffect(() => {
    setInverterPage(1);
  }, [selectedInverterBrand, inverterPhaseFilter, inverterSearch]);

  // Filtered inverter brands list based on brand search input
  const filteredInverterBrands = useMemo(() => {
    const list = Array.isArray(inverterBrands) ? inverterBrands.filter(Boolean) : [];
    if (!inverterBrandSearch.trim()) return list;
    return list.filter(b => b.name.toLowerCase().includes(inverterBrandSearch.toLowerCase()));
  }, [inverterBrands, inverterBrandSearch]);

  if (initialLoading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-black h-screen w-screen overflow-hidden">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-white animate-spin" />
          <span className="text-sm font-semibold text-neutral-400 animate-pulse">Initializing equipment workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden text-neutral-100 font-sans select-none relative">
      
      {/* Premium Top Navigation Bar */}
      <ProjectTopbar
        projectName={projectName}
        currentStage={4} // Panel Selection
        saving={savingStep}
        onContinue={handleFinishSelection}
      />

      {/* Main split-screen panel */}
      <div className="flex-grow flex w-full overflow-hidden">
        
        {/* Left progress column */}
        <aside className="w-[280px] bg-neutral-950/80 border-r border-white/10 flex-shrink-0 flex flex-col p-6 gap-6 font-sans justify-between">
          <div className="flex flex-col gap-6">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Configuration Stages</span>
            
            <nav className="flex flex-col gap-2">
              {[
                { key: "panel", label: "Panels", icon: Cpu, desc: selectedPanel ? `${selectedPanel.brand} (${selectedPanel.rating}W)` : "Choose panel model" },
                { key: "capacity", label: "DC Capacity", icon: Layers, desc: selectedPowerKwp ? `${selectedPowerKwp.toFixed(2)} kWp` : "Configure capacity" },
                { key: "inverter", label: "Inverters", icon: Zap, desc: selectedInverter ? `${selectedInverter.brand} (${selectedInverter.rated_ac_output}kW)` : "Select inverter" },
                { key: "accessories", label: "Accessories", icon: Settings, desc: "Cables, MCBs, battery" }
              ].map((step) => {
                const isCurrent = activeStep === step.key;
                const isDone = (step.key === "panel" && selectedPanel) || 
                              (step.key === "capacity" && capacityConfirmed && selectedPowerKwp > 0) || 
                              (step.key === "inverter" && selectedInverter) ||
                              (step.key === "accessories" && accessoriesCompleted);

                const locked = isStepLocked(step.key as any);

                return (
                  <button
                    key={step.key}
                    disabled={locked}
                    onClick={() => !locked && setActiveStep(step.key as any)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      locked
                        ? "opacity-35 cursor-not-allowed border-transparent text-neutral-600"
                        : isCurrent 
                        ? "bg-white/5 border-white/15 text-white" 
                        : isDone ? "bg-green-900/10 border-green-900/50 text-green-200" : "bg-transparent border-transparent text-neutral-400 hover:text-white"
                    }`}
                  >
                    <div className={`p-2 rounded-lg flex items-center justify-center ${isCurrent ? "bg-white text-black" : "bg-white/5 text-neutral-400"}`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold leading-none">{step.label}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-medium truncate">{step.desc}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Right workspace content area */}
        <main className="flex-1 bg-neutral-900/40 p-8 overflow-y-auto flex flex-col gap-6 relative">
          
          {/* STAGE 1: SOLAR PANELS VIEW */}
          {activeStep === "panel" && (
            <div className="flex flex-col gap-4 h-full max-w-5xl mx-auto w-full animate-in fade-in duration-200 overflow-hidden">
              
              {/* Brand selection area on top */}
              <div className="flex flex-col gap-3 bg-neutral-950/40 p-4 rounded-2xl border border-white/5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Brands</span>
                  <input
                    type="text"
                    placeholder="Search brands..."
                    value={panelBrandSearch}
                    onChange={(e) => setPanelBrandSearch(e.target.value)}
                    className="bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 w-44"
                  />
                </div>
                
                {/* Horizontal scrollable brand logo list */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {filteredPanelBrands.map((b) => {
                    const isBrandSelected = selectedPanelBrand === b.brand;
                    return (
                      <button
                        key={b.brand}
                        onClick={() => setSelectedPanelBrand(isBrandSelected ? null : b.brand)}
                        className={`h-16 px-6 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                          isBrandSelected
                            ? "bg-white/10 border-white/30 text-white"
                            : "bg-white/5 border-white/5 text-neutral-400 hover:border-white/10"
                        }`}
                      >
                        {b.brand_image ? (
                          <img src={b.brand_image} alt={b.brand} className="max-h-8 max-w-[100px] object-contain filter" />
                        ) : (
                          <span className="text-xs font-bold truncate">{b.brand}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 flex-shrink-0">
                {/* Search Models bar */}
                <div className="flex flex-col gap-1 w-64">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase">Search Models</span>
                  <input
                    type="text"
                    placeholder="Search panel models..."
                    value={panelSearch}
                    onChange={(e) => setPanelSearch(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 w-full"
                  />
                </div>

                {/* Technology dropdown */}
                <div className="flex flex-col gap-1 w-48">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase">Technology</span>
                  <select
                    value={panelTechFilter}
                    onChange={(e) => setPanelTechFilter(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20 w-full cursor-pointer"
                  >
                    <option value="all">All Tech</option>
                    <option value="monoPERC">Mono PERC</option>
                    <option value="TOPCon">TOPCon</option>
                    <option value="TOPcon (N-Type)">TOPcon (N-Type)</option>
                    <option value="HJT">HJT</option>
                  </select>
                </div>
              </div>

              {/* Modules Candidate List */}
              <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto">
                {loadingPanels ? (
                  <div className="flex items-center justify-center p-12">
                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                  </div>
                ) : panelItems.length === 0 ? (
                  <div className="text-center text-xs text-neutral-500 p-12 bg-white/5 rounded-2xl border border-white/5">
                    No solar panel models matched the selected filter criteria.
                  </div>
                ) : (
                  panelItems.map((panel) => {
                    const isSelected = selectedPanel?.id === panel.id;
                    const isExpanded = expandedPanelId === panel.id;
                    return (
                      <button
                        key={panel.id}
                        onClick={() => handleSelectPanel(panel)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-white/10 border-white/30 text-white" 
                            : "bg-white/5 border-white/5 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {panel.image && (
                              <img src={panel.image} alt={panel.app_name || ""} className="w-10 h-10 object-contain bg-white/5 rounded-lg border border-white/5 p-1 flex-shrink-0" />
                            )}
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{panel.app_name || panel.panel_name}</span>
                              <span className="text-[10px] text-neutral-500 mt-0.5">Rating: {panel.rating}Wp | Tech: {panel.technology || "TOPCon"}</span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPanelId(isExpanded ? null : panel.id);
                            }}
                            className="text-[10px] text-neutral-400 hover:text-white font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Specs</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5 text-[10px] text-neutral-400 leading-normal animate-in slide-in-from-top-2 duration-150">
                            <div>
                              <span className="block font-bold text-white">Origin</span>
                              <span>{normalizeDcrValue(panel.dcr) ? "DCR" : "Non-DCR"}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-white">Module Type</span>
                              <span>{panel.module_type}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-white">Dimensions</span>
                              <span>{panel.length} × {panel.breadth} × {panel.height} mm</span>
                            </div>
                            <div>
                              <span className="block font-bold text-white">VOC/VMP</span>
                              <span>{panel.voc || "—"} / {panel.vmp || "—"} V</span>
                            </div>
                            <div>
                              <span className="block font-bold text-white">ISC/IMP</span>
                              <span>{panel.isc || "—"} / {panel.imp || "—"} A</span>
                            </div>
                            <div>
                              <span className="block font-bold text-white">Warranty</span>
                              <span>{panel.product_warranty} Years</span>
                            </div>
                            <div>
                              <span className="block font-bold text-white">Output Guarantee</span>
                              <span>{panel.power_output_warranty} Years</span>
                            </div>
                            <div>
                              <span className="block font-bold text-white">Cell Type</span>
                              <span>{panel.cell_type || "Monocrystalline"}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-white">Cell Design</span>
                              <span>{panel.cell_design || "Standard"}</span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Pagination Controls */}
              {!loadingPanels && (panelPage > 1 || panelHasMore) && (
                <div className="flex-shrink-0 flex items-center justify-between pt-2  border-t border-white/10 mt-auto">
                  <span className="text-[10px] text-neutral-500 font-bold">
                    Page {panelPage}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={panelPage === 1}
                      onClick={() => setPanelPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      disabled={!panelHasMore}
                      onClick={() => setPanelPage(p => p + 1)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: SYSTEM CAPACITY VIEW */}
          {activeStep === "capacity" && (
            <div className="flex flex-col gap-6 h-full max-w-2xl mx-auto w-full animate-in fade-in duration-200">
              <div className="flex flex-col gap-1">
                <h1 className="text-xl font-bold text-white">Target System Capacity</h1>
                <p className="text-xs text-neutral-400">Lock the solar plant load size matching local space limits.</p>
              </div>

              {/* Roof layout stats card */}
              {panelCalculation && (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Roof Boundary Calculations</span>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">Total Boundary Area:</span>
                      <span className="text-sm font-bold text-white">{panelCalculation.total_roof_area?.toFixed(1) || 0} m²</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">Obstruction Buffer:</span>
                      <span className="text-sm font-bold text-white">{panelCalculation.obstruction_area?.toFixed(1) || 0} m²</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">Remaining Free Area:</span>
                      <span className="text-sm font-bold text-white">{panelCalculation.remaining_area?.toFixed(1) || 0} m²</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">Effective Solar Area:</span>
                      <span className="text-sm font-bold text-white">{roofSuggestion?.effective.toFixed(1) || 0} m²</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Capacity settings card */}
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col gap-6">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Adjust Target Capacity</span>

                <div className="flex items-center gap-3">
                  <div className="flex-grow flex items-center bg-neutral-900 border border-white/10 rounded-xl px-4 py-2">
                    <input
                      type="number"
                      step="0.1"
                      value={selectedPowerKwp || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSelectedPowerKwp(val);
                        setCapacityConfirmed(false);
                        setSelectedInverter(null);
                        setInverters([]);
                      }}
                      className="bg-transparent text-lg text-white font-bold focus:outline-none w-full text-left"
                    />
                    <span className="text-sm font-bold text-neutral-500">kWp</span>
                  </div>

                  <button
                    onClick={() => {
                      if (panelCalculation) {
                        const rating = selectedPanel?.rating || panelCalculation?.panel_rating || 550;
                        const autoKwp = capSystemKwp((roofSuggestion?.suggested ?? 0) * (rating / 1000));
                        setSelectedPowerKwp(autoKwp);
                        setCapacityConfirmed(false);
                        setSelectedInverter(null);
                        setInverters([]);
                      }
                    }}
                    className="bg-white hover:bg-neutral-200 text-black px-5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0"
                  >
                    Auto
                  </button>
                </div>

                {(() => {
                  const rating = selectedPanel?.rating || panelCalculation?.panel_rating || 550;
                  const ratingKw = rating / 1000;
                  const sliderStep = ratingKw > 0 ? ratingKw : 0.1;
                  const sliderMaxKwp = 50.0;
                  return (
                    <div className="flex flex-col gap-2">
                      <input
                        type="range"
                        min="0"
                        max={sliderMaxKwp}
                        step={sliderStep}
                        value={Math.min(selectedPowerKwp, sliderMaxKwp)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setSelectedPowerKwp(capSystemKwp(val));
                          setCapacityConfirmed(false);
                          setSelectedInverter(null);
                          setInverters([]);
                        }}
                        className="w-full accent-white cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-neutral-500 font-bold">
                        <span>0.00 kWp</span>
                        <span>{sliderMaxKwp.toFixed(2)} kWp</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="border-t border-white/5 pt-4 flex flex-col gap-3 text-xs text-neutral-450">
                  <div className="flex justify-between">
                    <span>Total No. of Panels</span>
                    <span className="font-bold text-white text-sm">{derivedPanelCount} Modules</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total DC Capacity</span>
                    <span className="font-bold text-white text-sm">
                      {((derivedPanelCount * (selectedPanel?.rating || panelCalculation?.panel_rating || 550)) / 1000).toFixed(2)} kWp
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Panel Rating Selection</span>
                    <span className="font-bold text-neutral-300">{selectedPanel?.rating || 550} Wp</span>
                  </div>
                </div>
                {powerLimitError && (
                  <div className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    {powerLimitError}
                  </div>
                )}
              </div>

              {/* Step Navigation */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5 flex-shrink-0">
                <button
                  onClick={() => setActiveStep("panel")}
                  className="bg-white/5 hover:bg-white/10 text-white border border-white/5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Back to Panels
                </button>
                <button
                  onClick={() => {
                    handleSaveCapacity();
                  }}
                  disabled={!!powerLimitError || selectedPowerKwp <= 0 || savingStep}
                  className="bg-white hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed text-black px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  {savingStep ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Next: Select Inverter</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* STAGE 3: SOLAR INVERTERS VIEW */}
          {activeStep === "inverter" && (
            <div className="flex flex-col gap-6 h-full max-w-5xl mx-auto w-full animate-in fade-in duration-200 overflow-hidden">
              
              {/* Brand selection area on top */}
              <div className="flex flex-col gap-3 bg-neutral-950/40 p-4 rounded-2xl border border-white/5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Brands</span>
                  <input
                    type="text"
                    placeholder="Search brands..."
                    value={inverterBrandSearch}
                    onChange={(e) => setInverterBrandSearch(e.target.value)}
                    className="bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 w-44"
                  />
                </div>
                
                {/* Horizontal scrollable brand logo list */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {filteredInverterBrands.map((b) => {
                    const isBrandSelected = selectedInverterBrand === b.name;
                    return (
                      <button
                        key={b.name}
                        onClick={() => setSelectedInverterBrand(isBrandSelected ? null : b.name)}
                        className={`h-16 px-6 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                          isBrandSelected
                            ? "bg-white/10 border-white/30 text-white"
                            : "bg-white/5 border-white/5 text-neutral-450 hover:border-white/10"
                        }`}
                      >
                        {b.logo_url ? (
                          <img src={b.logo_url} alt={b.name} className="max-h-8 max-w-[100px] object-contain" />
                        ) : (
                          <span className="text-xs font-bold truncate">{b.name}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 flex-shrink-0">
                <div className="flex flex-col gap-0.5 flex-grow">
                  <span className="text-xs font-bold text-white">Available Inverters</span>
                  <span className="text-[10px] text-neutral-500">Select compatible inverter for {selectedPowerKwp.toFixed(2)} kWp size</span>
                </div>

                {/* Search Inverters bar */}
                <div className="flex flex-col gap-1 w-64">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase">Search Inverters</span>
                  <input
                    type="text"
                    placeholder="Search inverter model..."
                    value={inverterSearch}
                    onChange={(e) => setInverterSearch(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 w-full"
                  />
                </div>

                {/* Phase selector dropdown */}
                <div className="flex flex-col gap-1 w-48">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase">Phase Filter</span>
                  <select
                    value={inverterPhaseFilter}
                    onChange={(e) => setInverterPhaseFilter(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20 w-full cursor-pointer"
                  >
                    <option value="all">All Phases</option>
                    <option value="single">Single Phase</option>
                    <option value="three">Three Phase</option>
                  </select>
                </div>
              </div>

              {/* Inverter cards list */}
              <div className="flex-grow flex flex-col gap-2 min-h-0 overflow-y-auto">
                {loadingInverters ? (
                  <div className="flex items-center justify-center p-12 flex-grow">
                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                  </div>
                ) : filteredInverters.length === 0 ? (
                  <div className="text-center text-xs text-neutral-500 p-12 bg-white/5 rounded-xl border border-white/5 flex-grow">
                    No inverters matched the system size of {selectedPowerKwp.toFixed(2)} kWp.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 flex-grow">
                    {paginatedInverters.map((inv) => {
                      const isSelected = selectedInverter?.id === inv.id;
                      const isExpanded = expandedInverterId === inv.id;
                      return (
                        <div
                          key={inv.id}
                          onClick={() => handleSelectInverter(inv)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 ${
                            isSelected 
                              ? "bg-white/10 border-white/30 text-white shadow-lg"
                              : "bg-white/5 border-white/5 text-neutral-300 hover:border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              {inv.image ? (
                                <img src={inv.image} alt={inv.app_name || inv.product_name || ""} className="w-10 h-10 object-contain bg-white/5 rounded-lg border border-white/5 p-1 flex-shrink-0" />
                              ) : inv.brand_image ? (
                                <img src={inv.brand_image} alt={inv.brand || ""} className="w-10 h-10 object-contain bg-white/5 rounded-lg border border-white/5 p-1 flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center flex-shrink-0">
                                  <Zap className="w-4 h-4 text-neutral-500" />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold truncate">{inv.app_name || inv.product_name || "Unnamed inverter"}</span>
                                <span className="text-[10px] text-neutral-500 mt-0.5">
                                  {inv.brand || "Unknown brand"} | {inv.rated_ac_output || "—"} kW | {inv.phase || "Phase —"}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedInverterId(isExpanded ? null : inv.id);
                              }}
                              className="text-[10px] text-neutral-400 hover:text-white font-bold flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Specs</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-1 pt-4 border-t border-white/5 text-[10px] text-neutral-400 leading-normal animate-in slide-in-from-top-2 duration-150">
                              <div>
                                <span className="block font-bold text-white">Rated AC Output</span>
                                <span>{inv.rated_ac_output || "—"} kW</span>
                              </div>
                              <div>
                                <span className="block font-bold text-white">Max DC Input</span>
                                <span>{inv.max_dc_input_power || "—"} kW</span>
                              </div>
                              <div>
                                <span className="block font-bold text-white">Phase</span>
                                <span>{inv.phase || "—"}</span>
                              </div>
                              <div>
                                <span className="block font-bold text-white">MPPT / Strings</span>
                                <span>{inv.no_of_mppt || "—"} / {inv.no_of_strings_per_mppt || "—"}</span>
                              </div>
                              <div>
                                <span className="block font-bold text-white">Max AC Current</span>
                                <span>{inv.max_ac_output_current || "—"} A</span>
                              </div>
                              <div>
                                <span className="block font-bold text-white">PV Input Current</span>
                                <span>{inv.max_pv_input_current_per_string || "—"} A/string</span>
                              </div>
                              <div>
                                <span className="block font-bold text-white">Voltage Window</span>
                                <span>{inv.mppt_min_voltage || "—"} - {inv.mppt_max_voltage || "—"} V</span>
                              </div>
                              <div>
                                <span className="block font-bold text-white">Warranty</span>
                                <span>{inv.warranty || "—"} Years</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {!loadingInverters && (inverterPage > 1 || inverterHasMore) && (
                <div className="flex-shrink-0 flex items-center justify-between border-t border-white/5 mt-auto">
                  <span className="text-[10px] text-neutral-500 font-bold">
                    Page {inverterPage}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={inverterPage === 1}
                      onClick={() => setInverterPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      disabled={!inverterHasMore}
                      onClick={() => setInverterPage(p => p + 1)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step Navigation */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5 flex-shrink-0">
                <button
                  onClick={() => setActiveStep("capacity")}
                  className="bg-white/5 hover:bg-white/10 text-white border border-white/5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Back to Capacity
                </button>
                {selectedInverter && (
                  <button
                    onClick={() => setActiveStep("accessories")}
                    className="bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>Next: Accessories</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STAGE 4: ACCESSORIES & CABLES VIEW */}
          {activeStep === "accessories" && (
            <div className="flex flex-col gap-5 h-full max-w-6xl mx-auto w-full animate-in fade-in duration-200 overflow-hidden">
              <div className="flex items-end justify-between gap-4 flex-shrink-0">
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-bold text-white">Accessories & Electrical Specifications</h1>
                  <p className="text-xs text-neutral-400">Fast desktop entry for strings, cables, protection, structure, and storage.</p>
                </div>
                <div className={`rounded-xl border px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${
                  canFinish ? "bg-green-500/10 border-green-500/30 text-green-200" : "bg-amber-500/10 border-amber-500/20 text-amber-200"
                }`}>
                  {canFinish ? "Ready to continue" : "Needs attention"}
                </div>
              </div>

              <div className="flex flex-col gap-5 min-h-0 flex-grow overflow-y-auto pr-2 scrollbar-thin">
                  <section className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="uppercase tracking-wider text-[10px] font-bold text-white">Strings & DC Side</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Strings</span>
                        <input type="number" value={stringCount} onChange={(e) => setStringCount(e.target.value.replace(/[^0-9]/g, ""))} className={`bg-neutral-900 border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-bold ${stringsOutOfRange ? "border-red-500/70" : "border-white/10 focus:border-white/20"}`} />
                        {stringBounds && <span className={`text-[10px] font-bold ${stringsOutOfRange ? "text-red-400" : "text-neutral-500"}`}>Allowed {stringBounds.min}-{stringBounds.max}</span>}
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">DC Cable Size (mm²)</span>
                        <input type="number" value={dcCableSize} onChange={(e) => setDcCableSize(e.target.value)} placeholder="e.g. 6" className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold" />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">DC Cable Length (m)</span>
                        <input type="number" value={dcCableLength} onChange={(e) => setDcCableLength(e.target.value)} placeholder="e.g. 30" className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold" />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">DC Cable Brand</span>
                        <select value={dcCableBrand} onChange={(e) => setDcCableBrand(e.target.value)} className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 cursor-pointer font-bold">
                          <option value="">Best practice</option>
                          {accessoryBrandOptions.dc_cable.map(brand => <option key={brand.name} value={brand.name}>{brand.name}</option>)}
                        </select>
                      </label>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">DCDB</span>
                        <div className="bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-neutral-400 font-bold">
                          {stringCount ? `${stringCount} in / ${stringCount} out` : "—"}
                        </div>
                      </div>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">DCDB Brand</span>
                        <select value={dcdbBrand} onChange={(e) => setDcdbBrand(e.target.value)} className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 cursor-pointer font-bold">
                          <option value="">Best practice</option>
                          {accessoryBrandOptions.dcdb.map(brand => <option key={brand.name} value={brand.name}>{brand.name}</option>)}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Zap className="w-4 h-4 text-emerald-500" />
                      <span className="uppercase tracking-wider text-[10px] font-bold text-white">AC Side</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">AC Cable Size (mm²)</span>
                        <input type="number" value={acCableSize} onChange={(e) => setAcCableSize(e.target.value)} placeholder="e.g. 6" className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold" />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">AC Cable Length (m)</span>
                        <input type="number" value={acCableLength} onChange={(e) => setAcCableLength(e.target.value)} placeholder="e.g. 20" className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold" />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">AC Cable Brand</span>
                        <select value={acCableBrand} onChange={(e) => setAcCableBrand(e.target.value)} className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 cursor-pointer font-bold">
                          <option value="">Best practice</option>
                          {accessoryBrandOptions.ac_cable.map(brand => <option key={brand.name} value={brand.name}>{brand.name}</option>)}
                        </select>
                      </label>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">ACDB</span>
                        <div className="bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-neutral-400 font-bold">
                          1 in / 1 out
                        </div>
                      </div>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">ACDB Brand</span>
                        <select value={acdbBrand} onChange={(e) => setAcdbBrand(e.target.value)} className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 cursor-pointer font-bold">
                          <option value="">Best practice</option>
                          {accessoryBrandOptions.acdb.map(brand => <option key={brand.name} value={brand.name}>{brand.name}</option>)}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Settings className="w-4 h-4 text-violet-400" />
                      <span className="uppercase tracking-wider text-[10px] font-bold text-white">Connectors, Structure & Storage</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">MC4 Connectors (Pcs)</span>
                        <input type="number" value={mc4Connectors} onChange={(e) => setMc4Connectors(e.target.value)} placeholder="e.g. 12" className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold" />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">MC4 Brand</span>
                        <select value={mc4Brand} onChange={(e) => setMc4Brand(e.target.value)} className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 cursor-pointer font-bold">
                          <option value="">Best practice</option>
                          {accessoryBrandOptions.mc4.map(brand => <option key={brand.name} value={brand.name}>{brand.name}</option>)}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Earthing Kit & LA (Pcs)</span>
                        <input type="number" value={earthingKit} onChange={(e) => setEarthingKit(e.target.value)} placeholder="e.g. 3" className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold" />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Earthing Brand</span>
                        <select value={earthingKitBrand} onChange={(e) => setEarthingKitBrand(e.target.value)} className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 cursor-pointer font-bold">
                          <option value="">Best practice</option>
                          {accessoryBrandOptions.earthing_kit.map(brand => <option key={brand.name} value={brand.name}>{brand.name}</option>)}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Structure Type</span>
                        <input type="text" value={structureType} onChange={(e) => setStructureType(e.target.value)} placeholder="e.g. Fixed Mounting Structure" className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold" />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Structure Material</span>
                        <input type="text" value={structureMaterial} onChange={(e) => setStructureMaterial(e.target.value)} placeholder="HDGI" className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold" />
                      </label>
                    </div>
                    <div className="border-t border-white/5 pt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-teal-400" />
                        <div>
                          <span className="block text-xs font-bold text-white">Battery Storage Backup</span>
                          <span className="block text-[10px] text-neutral-500 font-bold">{batteryEnabled ? "Included in proposal" : "Not included"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {batteryEnabled && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Battery Capacity (kWh)</span>
                            <input type="number" value={batteryKwh} onChange={(e) => setBatteryKwh(e.target.value)} placeholder="e.g. 5.12" className={`w-28 bg-neutral-900 border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-bold ${batteryInvalid ? "border-red-500/70" : "border-white/10 focus:border-white/20"}`} />
                          </div>
                        )}
                        <button onClick={() => setBatteryEnabled((v) => !v)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${batteryEnabled ? "bg-white text-black border-white" : "bg-white/5 text-white border-white/10 hover:bg-white/10"}`}>
                          {batteryEnabled ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                    </div>
                  </section>
              </div>

              <div className="flex justify-start pt-4 border-t border-white/5 flex-shrink-0">
                <button
                  onClick={() => setActiveStep("inverter")}
                  className="bg-white/5 hover:bg-white/10 text-white border border-white/5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Back to Inverters
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-white shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-2 select-none">
          <span className="text-amber-500">⚠️</span>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-neutral-500 hover:text-white ml-2">✕</button>
        </div>
      )}

    </div>
  );
}
