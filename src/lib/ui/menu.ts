import type { IconName } from "./icons";

export type MenuEntry =
  | {
      id: string;
      label: string;
      icon?: IconName;
      /** Shortcut hint on the right, e.g. "F2". */
      shortcut?: string;
      /** Red text, for delete. Still asks for confirmation elsewhere. */
      danger?: boolean;
      disabled?: boolean;
      onselect: () => void;
    }
  | { separator: true };
