import { memo } from "react"
import { CodeIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const Code2Icon = memo((props: SvgProps) => <Glyph {...props} />)

Code2Icon.displayName = "Code2Icon"
