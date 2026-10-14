import {
  FileTextIcon,
  FolderIcon,
  SquaresFourIcon,
  ListBulletsIcon,
  MonitorIcon,
  ArticleIcon,
  PaletteIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
  SlidersHorizontalIcon,
  StorefrontIcon,
  TagIcon,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useI18n } from '@/i18n'
import { useContentTypes, useTaxonomies } from '@/hooks/useContents'
import { useKindLabel, useTaxonomyLabel } from '@/hooks/useKindLabel'
import { type SidebarData } from '../types'

const kindIcons: Record<string, Icon> = {
  post: ArticleIcon,
  page: FileTextIcon,
}

const taxonomyIcons: Record<string, Icon> = {
  categories: FolderIcon,
  tags: TagIcon,
}

/**
 * useSidebarData is the navigation, built from what the project has: one
 * entry per content kind it declares and per taxonomy, as a blog's posts,
 * pages, categories and tags, and nothing it does not.
 */
export function useSidebarData(): SidebarData {
  const { t } = useI18n()
  const types = useContentTypes()
  const kindLabel = useKindLabel()
  const taxonomies = useTaxonomies()
  const taxonomyLabel = useTaxonomyLabel()

  // Until the answers arrive the built-in kinds and taxonomies hold the rail's shape.
  const kinds = types.data?.items.map((type) => type.kind) ?? ['post', 'page']
  const names = taxonomies.data?.items.map((item) => item.name) ?? ['categories', 'tags']

  return {
    navGroups: [
      {
        title: t('nav.general'),
        items: [{ title: t('nav.dashboard'), url: '/', icon: SquaresFourIcon }],
      },
      {
        title: t('nav.content'),
        items: [
          ...kinds.map((kind) => ({
            title: kindLabel.many(kind),
            url: `/content/${encodeURIComponent(kind)}`,
            icon: kindIcons[kind] ?? FileTextIcon,
          })),
          ...names.map((name) => ({
            title: taxonomyLabel(name),
            url: `/taxonomies/${encodeURIComponent(name)}`,
            icon: taxonomyIcons[name] ?? TagIcon,
          })),
        ],
      },
      {
        title: t('nav.system'),
        items: [
          { title: t('nav.deploy'), url: '/deploy', icon: RocketLaunchIcon },
          { title: t('nav.plugins'), url: '/plugins', icon: PuzzlePieceIcon },
          { title: t('nav.apps'), url: '/apps', icon: StorefrontIcon },
        ],
      },
      // Every setting is one click away rather than behind a fold. The
      // account is the person's, reached from their name at the foot.
      {
        title: t('nav.settings'),
        items: [
          // The account's page is under this address too, but is not the site's.
          { title: t('nav.site'), url: '/settings', icon: SlidersHorizontalIcon, exact: true },
          { title: t('nav.theme'), url: '/settings/theme', icon: PaletteIcon },
          { title: t('nav.menus'), url: '/settings/menus', icon: ListBulletsIcon },
          { title: t('settings.interface'), url: '/settings/appearance', icon: MonitorIcon },
        ],
      },
    ],
  }
}
