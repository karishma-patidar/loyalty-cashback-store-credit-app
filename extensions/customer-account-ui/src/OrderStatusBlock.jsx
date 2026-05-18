import { extension, Banner, Text } from '@shopify/ui-extensions/customer-account';

export default extension(
  'customer-account.order-status.block.render',
  (root) => {
    const banner = root.createComponent(Banner, {
      status: 'success',
      title: 'Cashback & Store Credit',
    });

    const text = root.createComponent(
      Text,
      {},
      'Congratulations! You earned store credit with this purchase. Your reward will be updated and credited to your account once your order is fulfilled.'
    );

    banner.appendChild(text);
    root.appendChild(banner);
  }
);
