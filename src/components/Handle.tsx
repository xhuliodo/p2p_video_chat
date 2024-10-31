import { SVGProps } from "react";
import { JSX } from "react/jsx-runtime";

export const Handle = (
  props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>,
) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M21 15L15 21M21 8L8 21"
      className="stroke-current" // Use this class to control the stroke color
      stroke="currentColor" // This allows the stroke color to take the current text color
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
