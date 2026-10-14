import { memo } from "react"
import { TextAaIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const CaseSensitiveIcon = memo((props: SvgProps) => <Glyph {...props} />)

CaseSensitiveIcon.displayName = "CaseSensitiveIcon"
