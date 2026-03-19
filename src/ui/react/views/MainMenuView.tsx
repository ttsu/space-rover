import { useState } from "react";
import { playClick } from "../../../audio/sounds";
import {
  deleteSave,
  getLastPlayedSaveId,
  listSaves,
  loadSave,
  type SaveIndexEntry,
} from "../../../state/Saves";

interface MainMenuViewProps {
  onNewGame: () => void;
  onLoadSave: () => void;
}

function formatTotalResources(
  totals: SaveIndexEntry["totalResourcesCollected"]
): string {
  const total = totals.iron + totals.crystal + totals.gas;
  return `${total} total (${totals.iron} iron, ${totals.crystal} crystal, ${totals.gas} gas)`;
}

export function MainMenuView(props: MainMenuViewProps) {
  const [, setTick] = useState(0);
  const saves = listSaves();
  const lastPlayedId = getLastPlayedSaveId();

  return (
    <div className="react-menu-screen">
      <div className="react-menu-panel react-menu-panel--compact">
        <div className="react-menu-header">
          <h1 className="react-menu-title">Space Rover Mission</h1>
        </div>

        <div className="react-button-row">
          <button
            className="react-button react-button--primary"
            onClick={() => {
              playClick();
              props.onNewGame();
            }}
            type="button"
          >
            New Game
          </button>
        </div>

        <section className="react-menu-section">
          <h2 className="react-menu-section-title">Saved games</h2>
          <div className="react-save-list">
            {saves.length === 0 ? (
              <div className="react-save-empty">No saved games yet.</div>
            ) : (
              saves.map((entry) => {
                const isLastPlayed = entry.id === lastPlayedId;
                const label = `${entry.difficulty} · ${formatTotalResources(entry.totalResourcesCollected)}`;
                return (
                  <div key={entry.id} className="react-save-row">
                    <div
                      className={`react-save-desc${isLastPlayed ? " react-save-desc--highlight" : ""}`}
                    >
                      {isLastPlayed ? `★ ${label}` : label}
                    </div>
                    <div className="react-save-actions">
                      <button
                        className="react-chip-button"
                        onClick={() => {
                          playClick();
                          if (loadSave(entry.id)) {
                            props.onLoadSave();
                          }
                        }}
                        type="button"
                      >
                        Load
                      </button>
                      <button
                        className="react-chip-button"
                        onClick={() => {
                          const confirmed =
                            typeof window !== "undefined" &&
                            window.confirm(
                              "Are you sure you want to delete this save?"
                            );
                          if (!confirmed) return;
                          deleteSave(entry.id);
                          setTick((value) => value + 1);
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
