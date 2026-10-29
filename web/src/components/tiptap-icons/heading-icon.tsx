import { memo } from "react"
import { TextHIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const HeadingIcon = memo((props: SvgProps) => <Glyph {...props} />)

HeadingIcon.displayName = "HeadingIcon"
