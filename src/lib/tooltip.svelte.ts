interface Tip {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  rows: [label: string, value: string][];
}

export const tip = $state<Tip>({ visible: false, x: 0, y: 0, title: '', rows: [] });

/** Mostra il riquadro vicino al puntatore, o accanto all'elemento se l'evento arriva da tastiera. */
export function showTip(event: MouseEvent | FocusEvent, title: string, rows: Tip['rows']): void {
  if (event instanceof MouseEvent && event.clientX + event.clientY > 0) {
    tip.x = event.clientX;
    tip.y = event.clientY;
  } else if (event.target instanceof Element) {
    const box = event.target.getBoundingClientRect();
    tip.x = box.left + box.width / 2;
    tip.y = box.top;
  }
  tip.title = title;
  tip.rows = rows;
  tip.visible = true;
}

export function hideTip(): void {
  tip.visible = false;
}
