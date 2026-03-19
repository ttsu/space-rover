import { playClick } from "../../../audio/sounds";
import { GameState } from "../../../state/GameState";
import { getBank } from "../../../state/Progress";
import { getGoalResults } from "../../../state/RunGoals";

interface SummaryViewProps {
  onBackToMenu: () => void;
}

function getSummaryData() {
  const run = GameState.lastRun;

  if (!run) {
    return {
      goalLines: [] as string[],
      bonusLine: "",
      statsLines: ["No mission data yet.", "Explore a planet first!"],
      failed: false,
    };
  }

  const results = getGoalResults();
  const goalLines = results.map(
    (result) =>
      `${result.met ? "✓" : "○"} ${result.goal.label}${result.met ? ` (+${result.bonusAmount} ${result.bonusResource})` : ""}`
  );

  const bonusTotal: Record<"iron" | "crystal" | "gas", number> = {
    iron: 0,
    crystal: 0,
    gas: 0,
  };

  for (const result of results) {
    if (result.met && result.bonusAmount > 0) {
      bonusTotal[result.bonusResource] += result.bonusAmount;
    }
  }

  const bonusParts = (["iron", "crystal", "gas"] as const)
    .filter((id) => bonusTotal[id] > 0)
    .map((id) => `+${bonusTotal[id]} ${id}`);

  const bank = getBank();
  const totalPieces = run.cargo.iron + run.cargo.crystal + run.cargo.gas;
  const failed = run.healthRemaining <= 0;

  const statsLines = failed
    ? [
        "Mission failed.",
        "Rover powered down.",
        `You had ${run.cargo.iron} iron, ${run.cargo.crystal} crystal, and ${run.cargo.gas} gas.`,
        "Return to base to save them next time.",
        `Capacity used: ${run.usedCapacity}/${run.maxCapacity}.`,
        `Bank: ${bank.iron} iron, ${bank.crystal} crystal, ${bank.gas} gas.`,
        `Best run so far: ${GameState.bestTotalCargo} pieces.`,
      ]
    : [
        "Mission complete!",
        `You collected ${run.cargo.iron} iron, ${run.cargo.crystal} crystal, and ${run.cargo.gas} gas.`,
        `That is ${totalPieces} pieces in all.`,
        `Added to your bank. Capacity used: ${run.usedCapacity}/${run.maxCapacity}.`,
        `Bank: ${bank.iron} iron, ${bank.crystal} crystal, ${bank.gas} gas.`,
        `Best run so far: ${GameState.bestTotalCargo} pieces.`,
      ];

  return {
    goalLines,
    bonusLine: bonusParts.length > 0 ? `Bonus: ${bonusParts.join(", ")}` : "",
    statsLines,
    failed,
  };
}

export function SummaryView(props: SummaryViewProps) {
  const summary = getSummaryData();

  return (
    <div className="react-menu-screen">
      <div className="react-menu-panel react-menu-panel--compact">
        <div className="react-menu-header">
          <h1 className="react-menu-title">Mission Summary</h1>
        </div>

        {summary.goalLines.length > 0 ? (
          <section className="react-menu-section">
            <h2 className="react-menu-section-title">Goals</h2>
            <div className="react-summary-block react-summary-block--goal">
              {summary.goalLines.map((line) => (
                <div key={line} className="react-summary-line">
                  {line}
                </div>
              ))}
              {summary.bonusLine ? (
                <div className="react-summary-bonus">{summary.bonusLine}</div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="react-menu-section">
          <div
            className={`react-summary-block${summary.failed ? " react-summary-block--failed" : ""}`}
          >
            {summary.statsLines.map((line) => (
              <div key={line} className="react-summary-line">
                {line}
              </div>
            ))}
          </div>
        </section>

        <div className="react-button-row">
          <button
            className="react-button react-button--primary"
            onClick={() => {
              playClick();
              props.onBackToMenu();
            }}
            type="button"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
