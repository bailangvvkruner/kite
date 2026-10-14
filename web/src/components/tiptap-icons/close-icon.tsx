import { memo } from "react"
import { XIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const CloseIcon = memo((props: SvgProps) => <Glyph {...props} />)

CloseIcon.displayName = "CloseIcon"
