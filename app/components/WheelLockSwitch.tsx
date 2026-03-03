"use client";

import styles from "./WheelLockSwitch.module.css";

type WheelLockSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
};

export default function WheelLockSwitch({
  checked,
  onChange,
  className,
}: WheelLockSwitchProps) {
  return (
    <label
      className={`${styles.toggleContainer}${className ? ` ${className}` : ""}`}
      title={checked ? "Wheel scrolling is enabled" : "Wheel scrolling is locked"}
      aria-label={checked ? "Disable wheel scrolling" : "Enable wheel scrolling"}
    >
      <input
        className={styles.toggleInput}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={styles.toggleHandleWrapper}>
        <div className={styles.toggleHandle}>
          <div className={styles.toggleHandleKnob} />
          <div className={styles.toggleHandleBarWrapper}>
            <div className={styles.toggleHandleBar} />
          </div>
        </div>
      </div>
      <div className={styles.toggleBase}>
        <div className={styles.toggleBaseInside} />
      </div>
    </label>
  );
}
