import { memo } from "react"
import { TextHTwoIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const HeadingTwoIcon = memo((props: SvgProps) => <Glyph {...props} />)

HeadingTwoIcon.displayName = "HeadingTwoIcon"
