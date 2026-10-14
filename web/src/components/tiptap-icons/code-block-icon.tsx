import { memo } from "react"
import { CodeBlockIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const CodeBlockIcon = memo((props: SvgProps) => <Glyph {...props} />)

CodeBlockIcon.displayName = "CodeBlockIcon"
