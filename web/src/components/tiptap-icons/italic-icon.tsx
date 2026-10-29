import { memo } from "react"
import { TextItalicIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const ItalicIcon = memo((props: SvgProps) => <Glyph {...props} />)

ItalicIcon.displayName = "ItalicIcon"
