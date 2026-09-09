import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Modern shadcn/ui style Select component.
 * Supports standard <option> children as a drop-in replacement for native selects,
 * rendering a custom animated floating popover menu with Check badges and keyboard navigation.
 */
export const Select = React.forwardRef(
  (
    {
      value,
      defaultValue,
      onChange,
      onValueChange,
      name,
      disabled = false,
      placeholder = "Select...",
      className,
      wrapperClassName,
      children,
      options: optionsProp,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(
      value !== undefined ? value : defaultValue !== undefined ? defaultValue : ""
    );
    const currentValue = value !== undefined ? value : internalValue;

    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    // Extract options from children (<option ...>) or options prop
    const options = React.useMemo(() => {
      if (optionsProp && Array.isArray(optionsProp)) {
        return optionsProp;
      }
      const list = [];
      React.Children.forEach(children, (child) => {
        if (!child) return;
        if (child.type === "option" || child.props?.value !== undefined) {
          list.push({
            value: child.props.value !== undefined ? child.props.value : child.props.children,
            label: child.props.children || String(child.props.value),
            disabled: !!child.props.disabled,
          });
        }
      });
      return list;
    }, [children, optionsProp]);

    // Find the currently selected option
    const selectedOption = options.find((opt) => String(opt.value) === String(currentValue));

    // Close on click outside
    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    // Close on Escape key
    useEffect(() => {
      if (!open) return;
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          setOpen(false);
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open]);

    const handleSelect = (optValue, isDisabled) => {
      if (isDisabled || disabled) return;
      setInternalValue(optValue);
      setOpen(false);

      if (onChange) {
        onChange({
          target: {
            value: optValue,
            name: name || "",
          },
        });
      }
      if (onValueChange) {
        onValueChange(optValue);
      }
    };

    return (
      <div
        ref={containerRef}
        className={cn("relative inline-block text-left", wrapperClassName)}
      >
        {/* Hidden select for standard form compatibility */}
        <select
          ref={ref}
          name={name}
          value={currentValue}
          disabled={disabled}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom shadcn UI Trigger button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-8 items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs transition-colors hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground whitespace-nowrap cursor-pointer select-none",
            open && "ring-1 ring-ring border-ring",
            className
          )}
          {...props}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0 opacity-70",
              open && "rotate-180 text-foreground opacity-100"
            )}
          />
        </button>

        {/* Floating popover dropdown menu */}
        {open && (
          <div
            role="listbox"
            className="absolute left-0 top-full mt-1 min-w-full w-max max-w-[280px] max-h-60 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-1 z-50 animate-in fade-in-0 zoom-in-95 duration-100 focus:outline-none"
          >
            {options.length === 0 ? (
              <div className="py-2 px-3 text-xs text-muted-foreground text-center">
                No options
              </div>
            ) : (
              options.map((opt) => {
                const isSelected = String(opt.value) === String(currentValue);
                return (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value, opt.disabled)}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center justify-between rounded-sm px-2.5 py-1.5 text-xs outline-none transition-colors",
                      opt.disabled
                        ? "pointer-events-none opacity-40"
                        : isSelected
                        ? "bg-accent text-accent-foreground font-semibold"
                        : "hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-auto" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export default Select;
