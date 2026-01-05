import { SetMetadata } from '@nestjs/common';

export const SKIP_CLIENT_VALIDATION_KEY = 'skipClientValidation';

export const SkipClientValidation = () => SetMetadata(SKIP_CLIENT_VALIDATION_KEY, true);