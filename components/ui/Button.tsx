import Link from "next/link";
import { forwardRef } from "react";

const VARIANTS = {
  primary:
    "brand-gradient text-white hover:opacity-90 hover:text-white rounded-full px-5 py-2.5 font-bold uppercase tracking-wide",
  ink: "bg-ink text-white hover:bg-navy hover:text-white rounded-full px-4 py-2",
  ghost:
    "border border-line bg-paper text-navy hover:bg-canvas hover:text-navy rounded-full px-4 py-2",
  danger: "bg-danger text-white hover:opacity-90 hover:text-white rounded-full px-4 py-2",
} as const;

type Variant = keyof typeof VARIANTS;

const BASE =
  "inline-flex items-center justify-center text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function buttonClass(variant: Variant = "ink", className = "") {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}

type Common = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = Common &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = Common &
  Omit<React.ComponentProps<typeof Link>, "className" | "children"> & {
    href: string;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonAsButton | ButtonAsLink>(
  function Button(props, ref) {
    const { variant = "ink", className = "", children, ...rest } = props;
    const classes = buttonClass(variant, className);

    if ("href" in rest && rest.href) {
      const { href, ...linkRest } = rest;
      return (
        <Link href={href} className={classes} {...linkRest}>
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} className={classes} {...(rest as ButtonAsButton)}>
        {children}
      </button>
    );
  },
);
