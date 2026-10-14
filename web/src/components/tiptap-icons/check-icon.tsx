import { memo } from "react"
import { CheckIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const CheckIcon = memo((props: SvgProps) => <Glyph {...props} />)

CheckIcon.displayName = "CheckIcon"
