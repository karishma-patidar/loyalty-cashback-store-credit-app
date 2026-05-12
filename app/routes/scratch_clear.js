import { authenticate } from "../shopify.server";
import { getShopPrograms, setShopPrograms } from "../services/graphql.server";

export async function clearPrograms(request) {
  const { admin } = await authenticate.admin(request);
  
  const { shopId } = await getShopPrograms(admin);
  const result = await setShopPrograms(admin, shopId, []);
  
  console.log("Clear results:", JSON.stringify(result, null, 2));
}
