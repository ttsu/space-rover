import { useEffect, useState } from "react";
import { playClick } from "../../../audio/sounds";
import {
  getTouchControlsEnabled,
  isTouchDeviceCapable,
  setTouchControlsEnabled,
} from "../../../input/TouchInputState";
import {
  canRepairShip,
  getBank,
  getEquipped,
  getOwnedItems,
  isShipRepaired,
  spendForShipRepair,
} from "../../../state/Progress";
import {
  generateGoalChoices,
  setCurrentGoals,
  type RunGoal,
} from "../../../state/RunGoals";
import { getCurrentSave } from "../../../state/Saves";
import { canAffordAnyEquipment } from "../../../upgrades/UpgradeDefs";

interface PlanetRunMenuViewProps {
  onStartRun: () => void;
  onConfigureRover: () => void;
  onSpaceship: () => void;
  onRepairShip?: () => void;
  onExitToMainMenu: () => void;
  onToggleTouch?: () => void;
}

function createGoalChoices(): RunGoal[] {
  const save = getCurrentSave();
  return generateGoalChoices(3, {
    biomePreset: save?.biomePreset ?? "barren",
  });
}

export function PlanetRunMenuView(props: PlanetRunMenuViewProps) {
  const [goalChoices] = useState<RunGoal[]>(() => createGoalChoices());
  const [, setTick] = useState(0);

  const bank = getBank();
  const ownedItems = getOwnedItems();
  const equipped = getEquipped();
  const shipRepaired = isShipRepaired();
  const canRepair = !shipRepaired && canRepairShip();
  const touchCapable = isTouchDeviceCapable();
  const touchEnabled = getTouchControlsEnabled();
  const canUpgrade = canAffordAnyEquipment(bank, ownedItems, equipped);

  useEffect(() => {
    setCurrentGoals(goalChoices);
  }, [goalChoices]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!touchCapable || event.key.toLowerCase() !== "t") return;
      event.preventDefault();
      setTouchControlsEnabled(!getTouchControlsEnabled());
      props.onToggleTouch?.();
      setTick((value) => value + 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props, touchCapable]);

  return (
    <div className="react-menu-screen">
      <div className="react-menu-panel react-menu-panel--compact">
        <div className="react-menu-header">
          <h1 className="react-menu-title">Planet base</h1>
          <p className="react-menu-subtitle">
            Bank: {bank.iron} iron, {bank.crystal} crystal, {bank.gas} gas
          </p>
        </div>

        <section className="react-menu-section">
          <h2 className="react-menu-section-title">
            Mission goals (complete any for bonus):
          </h2>
          <div className="react-menu-goals">
            {goalChoices.map((goal) => (
              <div key={goal.label} className="react-menu-goal">
                {goal.label}
              </div>
            ))}
          </div>
        </section>

        <div className="react-button-row">
          <button
            className="react-button react-button--primary"
            onClick={() => {
              playClick();
              setCurrentGoals(goalChoices);
              props.onStartRun();
            }}
            type="button"
          >
            Start Run
          </button>

          <button
            className={`react-button${canUpgrade ? " react-button--highlight" : ""}`}
            onClick={() => {
              playClick();
              props.onConfigureRover();
            }}
            type="button"
          >
            Configure Rover
          </button>

          {shipRepaired ? (
            <button
              className="react-button"
              onClick={() => {
                playClick();
                props.onSpaceship();
              }}
              type="button"
            >
              Spaceship
            </button>
          ) : canRepair ? (
            <button
              className="react-button react-button--warning"
              onClick={() => {
                playClick();
                if (!spendForShipRepair()) return;
                props.onRepairShip?.();
                setTick((value) => value + 1);
              }}
              type="button"
            >
              Repair ship
            </button>
          ) : null}

          <button
            className="react-button react-button--subtle"
            onClick={() => {
              playClick();
              props.onExitToMainMenu();
            }}
            type="button"
          >
            Exit to Main Menu
          </button>

          {touchCapable ? (
            <button
              className="react-button react-button--subtle"
              onClick={() => {
                playClick();
                setTouchControlsEnabled(!touchEnabled);
                props.onToggleTouch?.();
                setTick((value) => value + 1);
              }}
              type="button"
            >
              Touch controls: {touchEnabled ? "On" : "Off"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
