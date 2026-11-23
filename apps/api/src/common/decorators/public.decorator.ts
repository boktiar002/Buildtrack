import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Route needs no login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
