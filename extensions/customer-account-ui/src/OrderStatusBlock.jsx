import { extension, Banner, Text } from '@shopify/ui-extensions/customer-account';

export default extension(
  'customer-account.order-status.block.render',
  (root) => {
    const banner = root.createComponent(Banner, {
      status: 'success',
      title: 'You will receive store credit after this purchase.',
    });

    const text = root.createComponent(Text, {
      size: 'small',
      appearance: 'subdued',
    });
    text.appendChild(root.createText('Powered by Loyalty Credit'));
    banner.appendChild(text);
    root.appendChild(banner);
  }
);