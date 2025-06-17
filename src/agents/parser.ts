import logger from '@utils/logger';

const UBER_EATS_DOMAIN = 'https://www.ubereats.com';

interface StoreInfo {
  name: string;
  url: string;
  deliveryTime: string;
}

function formatStoreOutput(store: StoreInfo): string {
  return `- ${store.name}, ${store.url}, Delivery in: ${store.deliveryTime}`;
}

export function parseUberEatsStores(rawText: string): string {
  if (!rawText.includes('- heading "All stores"')) {
    return rawText;
  }

  const stores: StoreInfo[] = [];

  // A new store block seems to start with a line like:
  // - generic [ref=e...]:
  const storeBlocks = rawText.split(/\n(?=\s*-\s*generic\s*\[ref=e\d+\]:)/);

  for (const block of storeBlocks) {
    try {
      const nameMatch = block.match(/- link "([^"]+)":/);
      const urlMatch = block.match(/- \/url: (.*)/);
      const timeMatch = block.match(/- generic: (\d+\s*min)/);

      if (nameMatch && urlMatch && timeMatch) {
        stores.push({
          name: nameMatch[1],
          url: `${UBER_EATS_DOMAIN}${urlMatch[1].trim()}`,
          deliveryTime: timeMatch[1],
        });
      }
    } catch (e) {
      logger.error('Error parsing store block:', e);
    }
  }

  if (stores.length > 0) {
    return stores.map(formatStoreOutput).join('\n');
  }

  return rawText;
}
