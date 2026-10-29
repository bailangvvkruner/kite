import { memo } from "react"
import { LinkSimpleIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const LinkIcon = memo((props: SvgProps) => <Glyph {...props} />)

LinkIcon.displayName = "LinkIcon"
