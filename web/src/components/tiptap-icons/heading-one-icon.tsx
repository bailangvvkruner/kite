import { memo } from "react"
import { TextHOneIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const HeadingOneIcon = memo((props: SvgProps) => <Glyph {...props} />)

HeadingOneIcon.displayName = "HeadingOneIcon"
