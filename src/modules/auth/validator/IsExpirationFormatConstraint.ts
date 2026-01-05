import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsExpirationFormatConstraint implements ValidatorConstraintInterface {
    private types = ['d', 'h', 'm', 'y'];

    validate(value: any) {
        const regex = new RegExp(`^[1-9][0-9]*[${this.types.join('')}]$`);
        return value === 'unlimited' || regex.test(value);
    }

    defaultMessage() {
        return `La propiedad "expiration" debe tener un formato válido (ej. 1d, 1h, 1m, 1y o "unlimited") y permitir los siguientes tipos: ${this.types.join(', ')}`;
    }
}

export function IsExpirationFormat(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isExpirationFormat',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsExpirationFormatConstraint,
        });
    };
}
