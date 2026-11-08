import { forwardRef } from "react";
import type { KribbelDie } from "../../shared/kribbeln";
import { DiceCupTable, type DiceCupHandle } from "./DiceCupTable";
import { KribbelnDice } from "./KribbelnDice";

export type KribbelnCupHandle = DiceCupHandle;

export const KribbelnTable = forwardRef<KribbelnCupHandle, {
  dice: KribbelDie[]; kept: number[]; rolling: boolean; pending: boolean; canRoll: boolean; canAct: boolean;
  reducedMotion: boolean; rollKey: string; turnKey: string; onToggle: (index: number) => void;
  onRoll: () => void; onPreparingChange: (value: boolean) => void;
}>(function KribbelnTable({ dice, kept, onToggle, ...control }, ref) {
  return <DiceCupTable ref={ref} {...control} hasResult={dice.length > 0} availableCount={6 - kept.length} keptCount={kept.length}
    renderDice={({ cupRef, inCup, preparing }) => <KribbelnDice dice={dice} kept={kept} disabled={!control.canAct || control.pending || preparing}
      rolling={control.rolling} inCup={inCup} cupRef={cupRef} rollKey={control.rollKey} onToggle={onToggle} />} />;
});
