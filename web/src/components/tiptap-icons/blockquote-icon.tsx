import { memo } from "react"
import { QuotesIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const BlockquoteIcon = memo((props: SvgProps) => <Glyph {...props} />)

BlockquoteIcon.displayName = "BlockquoteIcon"
