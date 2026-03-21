export const SKLAND_CATALOG_URLS = {
  character: 'https://wiki.skland.com/endfield/catalog?typeMainId=1&typeSubId=1',
  weapon: 'https://wiki.skland.com/endfield/catalog?typeMainId=1&typeSubId=2'
};

export const CURRENT_SYNC_SOURCE_LABEL = 'Warfarin Wiki';

export function getSklandCatalogUrl(type = 'character') {
  return type === 'weapon' ? SKLAND_CATALOG_URLS.weapon : SKLAND_CATALOG_URLS.character;
}

export function getSklandCatalogLabel(type = 'character') {
  return type === 'weapon' ? '森空岛终末地WIKI 武器图鉴' : '森空岛终末地WIKI 角色图鉴';
}
