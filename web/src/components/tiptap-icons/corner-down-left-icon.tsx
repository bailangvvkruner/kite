import { memo } from "react"
import { ArrowElbowDownLeftIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const CornerDownLeftIcon = memo((props: SvgProps) => <Glyph {...props} />)

CornerDownLeftIcon.displayName = "CornerDownLeftIcon"
