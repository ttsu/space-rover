import { useMemo, useState } from "react";
import { playClick } from "../../../audio/sounds";
import { requestFullscreen } from "../../../fullscreen";
import {
  getBank,
  getCargoLayout,
  getCargoRows,
  getEquipped,
  getOwnedItems,
  purchaseEquipment,
  setCargoLayout,
  setCargoRows,
  setEquipped,
  spendFromBank,
} from "../../../state/Progress";
import type { CargoSlotContentSave } from "../../../state/Saves";
import { getCurrentGoals } from "../../../state/RunGoals";
import {
  ALL_SLOT_IDS,
  CARGO_MAX_ROWS,
  DEFAULT_EQUIPPED_IDS,
  type SlotId,
} from "../../../types/roverConfig";
import {
  canAffordCost,
  formatCost,
  getCatalogDefs,
  getUpgradeById,
} from "../../../upgrades/UpgradeDefs";

interface ConfigureRoverViewProps {
  onStartMission: () => void;
  onBackToPlanetRunMenu: () => void;
}

const SLOT_COLORS: Record<SlotId, string> = {
  battery: "#facc15",
  engine: "#f97316",
  control: "#22d3ee",
  shielding: "#f43f5e",
  radar: "#3b82f6",
  blaster: "#a855f7",
};

const SLOT_LABELS: Record<SlotId, string> = {
  battery: "Battery",
  engine: "Engine",
  control: "Control",
  shielding: "Shielding",
  radar: "Radar",
  blaster: "Blaster",
};

const CARGO_COLORS: Record<CargoSlotContentSave, string> = {
  empty: "#374151",
  gas: "#22c55e",
  crystal: "#a855f7",
  iron: "#9ca3af",
};

const CARGO_LABELS: Record<CargoSlotContentSave, string> = {
  empty: "Empty",
  gas: "Gas Canister",
  crystal: "Crystal Crate",
  iron: "Iron Hopper",
};

const CARGO_CYCLE: CargoSlotContentSave[] = ["empty", "gas", "crystal", "iron"];

function nextCargoContent(current: CargoSlotContentSave): CargoSlotContentSave {
  const nextIndex = (CARGO_CYCLE.indexOf(current) + 1) % CARGO_CYCLE.length;
  return CARGO_CYCLE[nextIndex] ?? "empty";
}

export function ConfigureRoverView(props: ConfigureRoverViewProps) {
  const [, setTick] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [tooltipText, setTooltipText] = useState<string>("");

  const goals = getCurrentGoals();
  const bank = getBank();
  const equipped = getEquipped();
  const ownedItems = getOwnedItems();
  const cargoLayout = getCargoLayout();
  const cargoRows = getCargoRows();
  const catalog = getCatalogDefs(ownedItems);

  const inventoryItems = useMemo(
    () =>
      Object.entries(ownedItems)
        .filter(([, level]) => level > 0)
        .map(([itemId, level]) => ({
          itemId,
          level,
          def: getUpgradeById(itemId),
        }))
        .filter(
          (
            item
          ): item is {
            itemId: string;
            level: number;
            def: NonNullable<ReturnType<typeof getUpgradeById>>;
          } => Boolean(item.def)
        ),
    [ownedItems]
  );

  const selectedDef = selectedItemId
    ? getUpgradeById(selectedItemId)
    : undefined;

  const refresh = () => setTick((value) => value + 1);

  return (
    <div
      className="react-menu-screen"
      onClick={() => setSelectedItemId(null)}
      role="presentation"
    >
      <div
        className="react-menu-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="react-menu-header">
          <h1 className="react-menu-title">Configure Rover</h1>
          <p className="react-menu-subtitle">
            Bank: {bank.iron} iron, {bank.crystal} crystal, {bank.gas} gas
          </p>
        </div>

        <section className="react-menu-section">
          <h2 className="react-menu-section-title">Mission goals</h2>
          <div className="react-menu-goals">
            {goals.map((goal) => (
              <div key={goal.label} className="react-menu-goal">
                {goal.label}
              </div>
            ))}
          </div>
        </section>

        <div className="react-config-layout">
          <div className="react-config-column">
            <section className="react-card">
              <h2 className="react-card-title">
                Equipment (slots & inventory)
              </h2>
              <div className="react-slot-grid">
                {ALL_SLOT_IDS.map((slotId) => {
                  const itemId = equipped[slotId];
                  const def = itemId ? getUpgradeById(itemId) : undefined;
                  const level = itemId ? (ownedItems[itemId] ?? 0) : 0;
                  const maxStack = def?.maxStack ?? 1;
                  const canLevelUp =
                    !!def && level < maxStack && canAffordCost(bank, def.cost);
                  const canAcceptSelected = selectedDef?.slotType === slotId;

                  return (
                    <div
                      key={slotId}
                      className={`react-slot-card${canAcceptSelected ? " react-slot-card--selected" : ""}`}
                    >
                      <div className="react-slot-header">
                        <span
                          className="react-slot-label"
                          style={{ color: SLOT_COLORS[slotId] }}
                        >
                          {SLOT_LABELS[slotId]}
                        </span>
                        <span className="react-muted">Level {level}</span>
                      </div>

                      <div className="react-slot-detail">
                        {def?.isBase ? "Base" : (def?.name ?? "Base")}
                      </div>

                      <div className="react-slot-actions">
                        <button
                          className="react-chip-button"
                          onClick={() => {
                            if (
                              selectedItemId &&
                              selectedDef?.slotType === slotId
                            ) {
                              setEquipped(slotId, selectedItemId);
                              playClick();
                              setSelectedItemId(null);
                              refresh();
                              return;
                            }

                            if (!selectedItemId) {
                              setEquipped(slotId, DEFAULT_EQUIPPED_IDS[slotId]);
                              playClick();
                              refresh();
                            }
                          }}
                          type="button"
                        >
                          {selectedItemId && canAcceptSelected
                            ? "Equip selected"
                            : "Reset to base"}
                        </button>

                        {canLevelUp && def ? (
                          <button
                            className="react-chip-button"
                            onClick={() => {
                              if (!purchaseEquipment(def)) return;
                              playClick();
                              refresh();
                            }}
                            type="button"
                          >
                            Level up ({formatCost(def.cost)})
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="react-card-title" style={{ marginTop: 14 }}>
                Inventory (click item, then click matching slot)
              </p>
              <div className="react-chip-list">
                {inventoryItems.map(({ itemId, level, def }) => (
                  <button
                    key={itemId}
                    className={`react-chip-button${selectedItemId === itemId ? " react-chip-button--selected" : ""}`}
                    onClick={() => {
                      playClick();
                      setSelectedItemId((current) =>
                        current === itemId ? null : itemId
                      );
                    }}
                    onMouseEnter={() =>
                      setTooltipText(`${def.name}: ${def.description}`)
                    }
                    onMouseLeave={() => setTooltipText("")}
                    style={{ backgroundColor: SLOT_COLORS[def.slotType] }}
                    type="button"
                  >
                    {def.name} ({level})
                  </button>
                ))}
              </div>
            </section>

            <section className="react-card">
              <h2 className="react-card-title">Cargo layout</h2>
              <div className="react-cargo-grid">
                {cargoLayout.map((content, index) => (
                  <button
                    key={`${index}-${content}`}
                    className="react-cargo-cell"
                    onClick={() => {
                      const newLayout = [...cargoLayout];
                      newLayout[index] = nextCargoContent(content);
                      setCargoLayout(newLayout);
                      playClick();
                      refresh();
                    }}
                    style={{ backgroundColor: CARGO_COLORS[content] }}
                    type="button"
                  >
                    {CARGO_LABELS[content]}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="react-config-column">
            <section className="react-card">
              <h2 className="react-card-title">Buy upgrades</h2>
              <div className="react-shop-list">
                {cargoRows < CARGO_MAX_ROWS ? (
                  <div className="react-shop-row">
                    <div>
                      <div className="react-shop-name">+1 Cargo Row</div>
                      <div className="react-shop-cost">8 crystal</div>
                    </div>
                    <button
                      className="react-chip-button"
                      disabled={bank.crystal < 8}
                      onClick={() => {
                        if (!spendFromBank({ crystal: 8 })) return;
                        setCargoRows(cargoRows + 1);
                        playClick();
                        refresh();
                      }}
                      type="button"
                    >
                      Purchase
                    </button>
                  </div>
                ) : null}

                {catalog.map((def) => (
                  <div key={def.id} className="react-shop-row">
                    <div>
                      <div className="react-shop-name">{def.name}</div>
                      <div className="react-shop-description">
                        {def.description}
                      </div>
                      <div className="react-shop-cost">
                        {formatCost(def.cost)}
                      </div>
                    </div>
                    <button
                      className="react-chip-button"
                      disabled={!canAffordCost(bank, def.cost)}
                      onClick={() => {
                        if (!purchaseEquipment(def)) return;
                        playClick();
                        refresh();
                      }}
                      type="button"
                    >
                      Purchase
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="react-card">
              <h2 className="react-card-title">Tooltip</h2>
              <div className="react-tooltip">
                {tooltipText ||
                  (selectedDef
                    ? `${selectedDef.name}: ${selectedDef.description}`
                    : "Hover an inventory item to see details.")}
              </div>
            </section>

            <section className="react-card">
              <h2 className="react-card-title">Selection</h2>
              <p className="react-muted">
                {selectedDef
                  ? `Selected: ${selectedDef.name}. Click a matching slot to equip it.`
                  : "No item selected. Click empty space to clear your selection."}
              </p>
            </section>
          </div>
        </div>

        <div className="react-bottom-actions">
          <button
            className="react-button react-button--primary"
            onClick={() => {
              playClick();
              void requestFullscreen().finally(() => {
                props.onStartMission();
              });
            }}
            type="button"
          >
            Start Mission
          </button>

          <button
            className="react-button react-button--subtle"
            onClick={() => {
              playClick();
              props.onBackToPlanetRunMenu();
            }}
            type="button"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
