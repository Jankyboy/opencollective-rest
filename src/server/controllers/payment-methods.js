import debug from 'debug';
import { get, pick } from 'lodash';
import moment from 'moment';

import { createPaymentMethodQuery, graphqlRequest } from '../lib/graphql';

const debugPaymentMethods = debug('paymentMethods');

export async function createPaymentMethod(req, res) {
  const type = get(req, 'body.type');

  // We only support creation of "virtualcard" payment methods
  if (type && type !== 'virtualcard') {
    throw new Error(`Creation of payment methods with type ${type} not allowed`);
  }

  const args = pick(req.body, [
    'description',
    'CollectiveId',
    'PaymentMethodId',
    'amount',
    'monthlyLimitPerMember',
    'currency',
    'expiryDate',
    'limitedToTags',
    'limitedToCollectiveIds',
    'limitedToHostCollectiveIds',
  ]);

  args.type = args.type || 'virtualcard';

  try {
    debugPaymentMethods({ args });

    const response = await graphqlRequest(createPaymentMethodQuery, args, { apiKey: req.apiKey });

    debugPaymentMethods({ response });

    const paymentMethod = get(response, 'createPaymentMethod');
    if (!paymentMethod) {
      throw new Error('No paymentMethod returned.');
    }

    res.send({
      id: paymentMethod.id,
      name: paymentMethod.name,
      CollectiveId: paymentMethod.collective.id,
      balance: paymentMethod.initialBalance,
      monthlyLimitPerMember: paymentMethod.monthlyLimitPerMember,
      currency: paymentMethod.currency,
      limitedToTags: paymentMethod.limitedToTags,
      limitedToCollectiveIds: paymentMethod.limitedToCollectiveIds,
      limitedToHostCollectiveIds: paymentMethod.limitedToHostCollectiveIds,
      code: paymentMethod.uuid.substring(0, 8),
      expiryDate: moment(new Date(paymentMethod.expiryDate)).format(),
      redeemUrl: `${process.env.WEBSITE_URL}/redeem?code=${paymentMethod.uuid.substring(0, 8)}`,
    });
  } catch (error) {
    debugPaymentMethods({ error });

    if (error.response && error.response.errors) {
      const singleError = error.response.errors[0];
      res.status(400).send({ error: singleError.message });
    } else if (error.response && error.response.error) {
      res.status(400).send({ error: error.response.error.message });
    } else {
      res.status(400).send({ error: error.toString() });
    }
  }
}
