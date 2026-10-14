import { memo } from "react"
import { TextBIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const BoldIcon = memo((props: SvgProps) => <Glyph {...props} />)

BoldIcon.displayName = "BoldIcon"
