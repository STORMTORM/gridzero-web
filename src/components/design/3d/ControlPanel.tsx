import { useState } from "react";
import { Eye, EyeOff, LayoutGrid } from "lucide-react";
import type { QualityLevel } from "../../../utils/design/types";
import Icon from "./Icon";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PRESETS = [
  { label: "Summer", month: 4 },
  { label: "Rain", month: 7 },
  { label: "Winter", month: 12 },
];

interface Props {
  viewMode: "roof" | "object" | "full";
  quality: QualityLevel; setQuality: (q: QualityLevel) => void;
  showGround: boolean; setShowGround: (v: boolean) => void;
  showRoofImage: boolean; setShowRoofImage: (v: boolean) => void;
  showPanels: boolean; setShowPanels: (v: boolean) => void;
  showTrees: boolean; setShowTrees: (v: boolean) => void;
  hasTrees: boolean;
  showAnalysis: boolean; setShowAnalysis: (v: boolean) => void;
  hasPanels: boolean;
  month: number; setMonth: (m: number) => void;
  displayTime: number; onTimeChange: (t: number) => void;
  playing: boolean; setPlaying: (v: boolean) => void;
  formatTime: (t: number) => string;
  onRunAnalysis: () => void;
  analysisRunning: boolean;
  analysisProgress: number;
}

export default function ControlPanel(p: Props) {
  const qualityLabel = p.quality === "high" ? "HQ" : p.quality === "medium" ? "MQ" : "LQ";
  const nextQuality = (): QualityLevel => p.quality === "high" ? "low" : p.quality === "low" ? "medium" : "high";
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <>
      {/* ── Left floating buttons ── */}
      {/* Share link */}
      <button onClick={() => {
        const url = window.location.href;
        if (navigator.share) {
          navigator.share({ title: "3D Preview", url }).catch(() => {});
        } else {
          navigator.clipboard.writeText(url).then(() => showToast("Link copied")).catch(() => showToast("Copy failed"));
        }
      }} style={{
        ...S.fab, top: 16, left: 16,
        background: "rgba(28,28,30,0.87)",
      }}>
        <Icon name="share-social-outline" size={20} color="#ccc" />
      </button>

      {/* Quality */}
      <button onClick={() => p.setQuality(nextQuality())} style={{
        ...S.fab, top: 68, left: 16,
        background: p.quality === "high" ? "rgba(167,206,56,0.95)" : p.quality === "medium" ? "rgba(28,28,30,0.93)" : "rgba(28,28,30,0.67)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: p.quality === "high" ? "#fff" : "#ccc" }}>{qualityLabel}</span>
      </button>

      {/* Ground toggle */}
      <button onClick={() => p.setShowGround(!p.showGround)} style={{
        ...S.fab, top: 120, left: 16,
        background: p.showGround ? "rgba(167,206,56,0.95)" : "rgba(28,28,30,0.87)",
      }}>
        <Icon name={p.showGround ? "image" : "grid-outline"} size={20} color={p.showGround ? "#fff" : "#ccc"} />
      </button>

      {/* Roof overlay toggle */}
      <button onClick={() => p.setShowRoofImage(!p.showRoofImage)} style={{
        ...S.fab, top: 172, left: 16,
        background: p.showRoofImage ? "rgba(167,206,56,0.95)" : "rgba(28,28,30,0.87)",
      }}>
        {p.showRoofImage
          ? <Eye size={20} color="#fff" strokeWidth={2.2} />
          : <EyeOff size={20} color="#ccc" strokeWidth={2.2} />}
      </button>

      {/* Panel toggle */}
      {p.viewMode === "full" && p.hasPanels && (
        <button onClick={() => p.setShowPanels(!p.showPanels)} style={{
          ...S.fab, top: 224, left: 16,
          background: p.showPanels ? "rgba(167,206,56,0.95)" : "rgba(28,28,30,0.87)",
        }}>
          <LayoutGrid
            size={20}
            color={p.showPanels ? "#fff" : "#ccc"}
            fill={p.showPanels ? "#fff" : "none"}
            strokeWidth={2.2}
          />
        </button>
      )}

      {/* Analysis toggle */}
      {p.viewMode === "full" && p.hasPanels && p.showPanels && (
        <button onClick={() => { if (p.analysisRunning) return; if (!p.showAnalysis) p.onRunAnalysis(); else p.setShowAnalysis(false); }} style={{
          ...S.fab, top: 276, left: 16,
          background: p.analysisRunning ? "rgba(255,152,0,0.5)" : p.showAnalysis ? "rgba(255,152,0,0.87)" : "rgba(28,28,30,0.87)",
          opacity: p.analysisRunning ? 0.6 : 1,
        }}>
          <Icon name="analytics" size={20} color={p.showAnalysis || p.analysisRunning ? "#fff" : "#ccc"} />
        </button>
      )}

      {/* ── Month presets bar ── */}
      <div style={S.monthBar}>
        {PRESETS.map((pr) => (
          <button key={pr.label} onClick={() => p.setMonth(pr.month)} style={{
            ...S.seasonChip,
            background: p.month === pr.month ? "rgba(167,206,56,0.95)" : "rgba(28,28,30,0.85)",
            borderColor: p.month === pr.month ? "#a7ce38" : "rgba(255,255,255,0.15)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: p.month === pr.month ? "#fff" : "#ccc" }}>{pr.label}</span>
          </button>
        ))}
        <div style={S.monthPicker}>
          <select value={p.month} onChange={(e) => p.setMonth(Number(e.target.value))} style={S.monthSelect}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* ── Time slider bar ── */}
      <div style={S.timeBar}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6, gap: 6 }}>
          <Icon name="time-outline" size={16} color="#FFC107" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{p.formatTime(p.displayTime)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          {/* Play/Pause */}
          <button onClick={() => p.setPlaying(!p.playing)} style={{
            width: 32, height: 32, borderRadius: 16, border: "none", cursor: "pointer",
            background: p.playing ? "#a7ce38" : "rgba(44,44,46,1)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name={p.playing ? "pause" : "play"} size={16} color={p.playing ? "#fff" : "#a7ce38"} />
          </button>
          <Icon name="sunny-outline" size={16} color="#a7ce38" />
          <span style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93" }}>6AM</span>
          <input type="range" min={6} max={19} step={0.25} value={p.displayTime}
            onChange={(e) => p.onTimeChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: "#a7ce38", height: 4 }} />
          <span style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93" }}>7PM</span>
        </div>
      </div>

      {/* ── Analysis progress overlay ── */}
      {p.analysisRunning && (
        <div style={S.progressOverlay}>
          <div style={S.progressCard}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Shadow Analysis</div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", borderRadius: 4, background: "#a7ce38", width: `${p.analysisProgress}%`, transition: "width 0.2s" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", textAlign: "center" }}>{p.analysisProgress}%</div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={S.toast}>{toast}</div>
      )}
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "8px 12px",
    background: "rgba(28,28,30,1)", borderBottom: "1px solid rgba(255,255,255,0.08)",
    zIndex: 20,
  },
  headerTitle: { fontSize: 16, fontWeight: 700, color: "#fff" },

  fab: {
    position: "absolute", width: 44, height: 44, borderRadius: 22,
    border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)", zIndex: 10,
  },

  monthBar: {
    position: "absolute", left: 16, right: 16,
    bottom: "calc(112px + env(safe-area-inset-bottom) + var(--vv-offset-bottom, 0px))",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
    zIndex: 10,
  },
  seasonChip: {
    flex: 1, padding: "8px 0", borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)",
    cursor: "pointer", textAlign: "center" as const,
    boxShadow: "0 3px 8px rgba(0,0,0,0.22)",
  },
  monthPicker: {
    flex: 1.15, borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(44,44,46,0.85)", padding: "4px 8px",
    boxShadow: "0 3px 8px rgba(0,0,0,0.22)",
  },
  monthSelect: {
    width: "100%", background: "transparent", color: "#fff", border: "none",
    fontSize: 11, fontWeight: 700, textAlign: "center" as const, cursor: "pointer",
    padding: "4px 0",
  },

  timeBar: {
    position: "absolute", left: 16, right: 16,
    bottom: "calc(16px + env(safe-area-inset-bottom) + var(--vv-offset-bottom, 0px))",
    borderRadius: 18, padding: "10px 14px",
    background: "rgba(28,28,30,0.78)", border: "1px solid rgba(56,56,58,0.4)",
    boxShadow: "0 4px 10px rgba(0,0,0,0.4)", zIndex: 10,
  },

  progressOverlay: {
    position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30,
  },
  progressCard: {
    width: 300, borderRadius: 20, padding: "16px 20px 20px",
    background: "rgba(28,28,30,1)", boxShadow: "0 8px 16px rgba(0,0,0,0.4)",
  },

  toast: {
    position: "absolute", left: "50%", top: 24, transform: "translateX(-50%)",
    background: "rgba(28,28,30,0.95)", color: "#fff",
    padding: "10px 18px", borderRadius: 999,
    fontSize: 13, fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    zIndex: 40, pointerEvents: "none",
  },
};
