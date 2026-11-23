import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE = 'responseMessage';

/** Sets the `message` field of the success envelope, e.g. @ResponseMessage('Payment recorded'). */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE, message);
