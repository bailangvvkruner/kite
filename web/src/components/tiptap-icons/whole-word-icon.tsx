import { memo } from "react"
import { TextAUnderlineIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const WholeWordIcon = memo((props: SvgProps) => <Glyph {...props} />)

WholeWordIcon.displayName = "WholeWordIcon"
