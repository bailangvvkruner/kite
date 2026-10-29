import { memo } from "react"
import { ImageIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const ImagePlusIcon = memo((props: SvgProps) => <Glyph {...props} />)

ImagePlusIcon.displayName = "ImagePlusIcon"
