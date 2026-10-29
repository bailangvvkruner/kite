import { memo } from "react"
import { TextStrikethroughIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const StrikeIcon = memo((props: SvgProps) => <Glyph {...props} />)

StrikeIcon.displayName = "StrikeIcon"
