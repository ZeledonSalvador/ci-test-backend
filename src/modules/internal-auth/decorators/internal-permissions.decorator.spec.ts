import 'reflect-metadata';
import { InternalPermissions } from './internal-permissions.decorator';

describe('InternalPermissions Decorator', () => {
  it('should create metadata decorator with single permission', () => {
    const permission = 'AutorizacionCamiones';

    const decorator = InternalPermissions(permission);

    class TestClass {
      testMethod() {}
    }

    decorator(
      TestClass.prototype,
      'testMethod',
      Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!,
    );

    const metadata = Reflect.getMetadata(
      'internal-permissions',
      TestClass.prototype.testMethod,
    );

    expect(metadata).toEqual([permission]);
  });

  it('should create metadata decorator with multiple permissions', () => {
    const permissions = ['AutorizacionCamiones', 'TiemposAzucar', 'AdminPanel'];

    const decorator = InternalPermissions(...permissions);

    class TestClass {
      testMethod() {}
    }

    decorator(
      TestClass.prototype,
      'testMethod',
      Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!,
    );

    const metadata = Reflect.getMetadata(
      'internal-permissions',
      TestClass.prototype.testMethod,
    );

    expect(metadata).toEqual(permissions);
  });

  it('should create metadata decorator with empty array when no permissions provided', () => {
    const decorator = InternalPermissions();

    class TestClass {
      testMethod() {}
    }

    decorator(
      TestClass.prototype,
      'testMethod',
      Object.getOwnPropertyDescriptor(TestClass.prototype, 'testMethod')!,
    );

    const metadata = Reflect.getMetadata(
      'internal-permissions',
      TestClass.prototype.testMethod,
    );

    expect(metadata).toEqual([]);
  });
});
