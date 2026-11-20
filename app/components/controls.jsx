import { useEffect, useRef } from "react";

// Polaris web components dispatch native "input"/"change" events and expect
// value/checked to be set as properties, so bridge them to React state here.
function Ctl({ as: Tag, value, checked, onValue, children, ...rest }) {
  const ref = useRef(null);
  const isCheck = Tag === "s-checkbox" || Tag === "s-switch";

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const handler = () => onValue(isCheck ? !!node.checked : node.value);
    node.addEventListener("input", handler);
    node.addEventListener("change", handler);
    return () => {
      node.removeEventListener("input", handler);
      node.removeEventListener("change", handler);
    };
  }, [onValue, isCheck]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (isCheck) {
      if (node.checked !== !!checked) node.checked = !!checked;
    } else if (node.value !== String(value ?? "")) {
      node.value = String(value ?? "");
    }
  });

  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  );
}

export const Text = (p) => <Ctl as="s-text-field" {...p} />;
export const Num = (p) => <Ctl as="s-number-field" {...p} />;
export const Color = (p) => <Ctl as="s-color-field" {...p} />;
export const Check = (p) => <Ctl as="s-checkbox" {...p} />;
export const Select = ({ options, ...p }) => (
  <Ctl as="s-select" {...p}>
    {options.map(([v, l]) => (
      <s-option key={v} value={String(v)}>
        {l}
      </s-option>
    ))}
  </Ctl>
);
