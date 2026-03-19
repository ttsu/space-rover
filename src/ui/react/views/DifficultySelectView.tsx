import { playClick } from "../../../audio/sounds";
import { createSave, type Difficulty } from "../../../state/Saves";

interface DifficultySelectViewProps {
  onDifficultySelected: () => void;
  onBack: () => void;
}

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Hard" },
];

export function DifficultySelectView(props: DifficultySelectViewProps) {
  return (
    <div className="react-menu-screen">
      <div className="react-menu-panel react-menu-panel--compact">
        <div className="react-menu-header">
          <h1 className="react-menu-title">Choose difficulty</h1>
        </div>

        <div className="react-difficulty-list">
          {DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty.id}
              className="react-button"
              onClick={() => {
                playClick();
                createSave(difficulty.id);
                props.onDifficultySelected();
              }}
              type="button"
            >
              {difficulty.label}
            </button>
          ))}
        </div>

        <div className="react-bottom-actions">
          <button
            className="react-button react-button--subtle"
            onClick={() => {
              playClick();
              props.onBack();
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
