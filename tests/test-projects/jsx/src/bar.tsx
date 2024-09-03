export interface BarProps {
  readonly innerNode: JSX.Element
}

export function Bar({ innerNode }: BarProps): JSX.Element {
  return <div>{innerNode}</div>
}
