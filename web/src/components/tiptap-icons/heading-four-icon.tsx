import { memo } from "react"
import { TextHFourIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const HeadingFourIcon = memo((props: SvgProps) => <Glyph {...props} />)

HeadingFourIcon.displayName = "HeadingFourIcon"
