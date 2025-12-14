import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-rose-900/20",
        destructive:
          "bg-red-500 text-destructive-foreground hover:bg-red-500/90",
        outline:
          "border border-rose-200 bg-background hover:bg-rose-50 hover:text-rose-900 dark:border-rose-800 dark:hover:bg-rose-950 dark:hover:text-rose-100",
        secondary:
          "bg-rose-100 text-rose-900 hover:bg-rose-200 dark:bg-rose-900 dark:text-rose-100 dark:hover:bg-rose-800",
        ghost: "hover:bg-rose-50 hover:text-rose-900 dark:hover:bg-rose-900/50 dark:hover:text-rose-100",
        link: "text-rose-600 underline-offset-4 hover:underline dark:text-rose-400",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
