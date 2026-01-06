import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataInconsistencyService } from './data-inconsistency.service';
import { DataInconsistency } from 'src/models/DataInconsistency';
import { Shipments } from 'src/models/Shipments';
import { Users } from 'src/models/Users';
import { ShipmentSeals } from 'src/models/ShipmentSeals';
import { Status } from 'src/models/Status';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';
import { TransactionLogsService } from '../../logs/services/transaction-logs.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InconsistencyType } from '../enums/inconsistency-types.enum';

describe('DataInconsistencyService', () => {
  let service: DataInconsistencyService;
  let dataInconsistencyRepository: Repository<DataInconsistency>;
  let shipmentsRepository: Repository<Shipments>;
  let usersRepository: Repository<Users>;
  let shipmentSealsRepository: Repository<ShipmentSeals>;
  let statusRepository: Repository<Status>;
  let predefinedStatusesRepository: Repository<PredefinedStatuses>;
  let transactionLogsService: TransactionLogsService;

  const mockDataInconsistencyRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockShipmentsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockUsersRepository = {
    findOne: jest.fn(),
  };

  const mockShipmentSealsRepository = {
    find: jest.fn(),
  };

  const mockStatusRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPredefinedStatusesRepository = {
    findOne: jest.fn(),
  };

  const mockTransactionLogsService = {
    createLog: jest.fn(),
    getLogsByCodeGen: jest.fn(),
    getLogsByDateRange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataInconsistencyService,
        {
          provide: getRepositoryToken(DataInconsistency),
          useValue: mockDataInconsistencyRepository,
        },
        {
          provide: getRepositoryToken(Shipments),
          useValue: mockShipmentsRepository,
        },
        {
          provide: getRepositoryToken(Users),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(ShipmentSeals),
          useValue: mockShipmentSealsRepository,
        },
        {
          provide: getRepositoryToken(Status),
          useValue: mockStatusRepository,
        },
        {
          provide: getRepositoryToken(PredefinedStatuses),
          useValue: mockPredefinedStatusesRepository,
        },
        {
          provide: TransactionLogsService,
          useValue: mockTransactionLogsService,
        },
      ],
    }).compile();

    service = module.get<DataInconsistencyService>(DataInconsistencyService);
    dataInconsistencyRepository = module.get<Repository<DataInconsistency>>(
      getRepositoryToken(DataInconsistency),
    );
    shipmentsRepository = module.get<Repository<Shipments>>(
      getRepositoryToken(Shipments),
    );
    usersRepository = module.get<Repository<Users>>(getRepositoryToken(Users));
    shipmentSealsRepository = module.get<Repository<ShipmentSeals>>(
      getRepositoryToken(ShipmentSeals),
    );
    statusRepository = module.get<Repository<Status>>(
      getRepositoryToken(Status),
    );
    predefinedStatusesRepository = module.get<Repository<PredefinedStatuses>>(
      getRepositoryToken(PredefinedStatuses),
    );
    transactionLogsService = module.get<TransactionLogsService>(
      TransactionLogsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportInconsistency', () => {
    const mockReportData = {
      codeGen: 'TEST-CODE-123',
      reportType: InconsistencyType.PRECHECK,
      license: '987654321',
      comments: 'Test comment',
      userId: 1,
    };

    const mockShipment = {
      id: 1,
      codeGen: 'TEST-CODE-123',
      currentStatus: 5,
      dateTimeCurrentStatus: new Date(),
      updatedAt: new Date(),
    };

    const mockUser = {
      id: 1,
      username: 'testuser',
    };

    const mockPredefinedStatus = {
      id: 13,
      name: 'Inconsistencia Reportada',
      description: 'Estado cuando se reporta una inconsistencia',
    };

    beforeEach(() => {
      mockShipmentsRepository.findOne.mockResolvedValue(mockShipment);
      mockUsersRepository.findOne.mockResolvedValue(mockUser);
      mockPredefinedStatusesRepository.findOne.mockResolvedValue(
        mockPredefinedStatus,
      );
      mockShipmentsRepository.save.mockResolvedValue({
        ...mockShipment,
        currentStatus: 13,
      });
      mockStatusRepository.create.mockReturnValue({});
      mockStatusRepository.save.mockResolvedValue({});
      mockTransactionLogsService.createLog.mockResolvedValue({});
    });

    it('should create new inconsistency report when none exists', async () => {
      mockDataInconsistencyRepository.findOne.mockResolvedValue(null);

      const mockCreatedReport = {
        id: 1,
        shipment: mockShipment,
        user: mockUser,
        inconsistencyType: JSON.stringify({
          precheck: {
            license: mockReportData.license,
            trailerPlate: undefined,
            truckPlate: undefined,
            reportedAt: expect.any(String),
            reportedBy: mockUser.username,
          },
        }),
        comments: mockReportData.comments,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDataInconsistencyRepository.create.mockReturnValue(mockCreatedReport);
      mockDataInconsistencyRepository.save.mockResolvedValue(mockCreatedReport);

      const result = await service.reportInconsistency(mockReportData);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('shipmentCodeGen', mockShipment.codeGen);
      expect(result).toHaveProperty('userName', mockUser.username);
      expect(mockDataInconsistencyRepository.create).toHaveBeenCalled();
      expect(mockDataInconsistencyRepository.save).toHaveBeenCalled();
      expect(mockShipmentsRepository.save).toHaveBeenCalledWith({
        ...mockShipment,
        currentStatus: 13,
        dateTimeCurrentStatus: expect.any(Date),
      });
      expect(mockStatusRepository.create).toHaveBeenCalled();
      expect(mockStatusRepository.save).toHaveBeenCalled();
      expect(mockTransactionLogsService.createLog).toHaveBeenCalled();
    });

    it('should update existing inconsistency report and update createdAt', async () => {
      const existingReport = {
        id: 1,
        shipment: mockShipment,
        user: { id: 2, username: 'otheruser' },
        inconsistencyType: JSON.stringify({
          seals: {
            sealIds: [1, 2],
            seals: [
              { id: 1, sealCode: 'SEAL001' },
              { id: 2, sealCode: 'SEAL002' },
            ],
            reportedAt: '2024-01-01T00:00:00.000Z',
            reportedBy: 'otheruser',
          },
        }),
        comments: 'Old comment',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockDataInconsistencyRepository.findOne.mockResolvedValue(existingReport);
      mockDataInconsistencyRepository.save.mockResolvedValue(existingReport);

      const result = await service.reportInconsistency(mockReportData);

      expect(result).toBeDefined();
      expect(mockDataInconsistencyRepository.save).toHaveBeenCalled();
      expect(existingReport.comments).toBe(mockReportData.comments);
      expect(existingReport.user).toBe(mockUser);
      expect(existingReport.createdAt).toEqual(expect.any(Date));
      expect(mockShipmentsRepository.save).toHaveBeenCalledWith({
        ...mockShipment,
        currentStatus: 13,
        dateTimeCurrentStatus: expect.any(Date),
      });
      expect(mockStatusRepository.create).toHaveBeenCalled();
      expect(mockTransactionLogsService.createLog).toHaveBeenCalled();
    });

    it('should handle seals inconsistency report', async () => {
      const sealsReportData = {
        codeGen: 'TEST-CODE-123',
        reportType: InconsistencyType.SEALS,
        comments: 'Seals inconsistency',
        userId: 1,
        sealIds: [1, 2],
      };

      const mockSeals = [
        { id: 1, sealCode: 'SEAL001', shipment: mockShipment },
        { id: 2, sealCode: 'SEAL002', shipment: mockShipment },
      ];

      mockShipmentSealsRepository.find.mockResolvedValue(mockSeals);
      mockDataInconsistencyRepository.findOne.mockResolvedValue(null);

      const mockCreatedReport = {
        id: 1,
        shipment: mockShipment,
        user: mockUser,
        inconsistencyType: JSON.stringify({
          seals: {
            sealIds: [1, 2],
            seals: [
              { id: 1, sealCode: 'SEAL001' },
              { id: 2, sealCode: 'SEAL002' },
            ],
            reportedAt: expect.any(String),
            reportedBy: mockUser.username,
          },
        }),
        comments: sealsReportData.comments,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDataInconsistencyRepository.create.mockReturnValue(mockCreatedReport);
      mockDataInconsistencyRepository.save.mockResolvedValue(mockCreatedReport);

      const result = await service.reportInconsistency(sealsReportData);

      expect(result).toBeDefined();
      expect(mockShipmentSealsRepository.find).toHaveBeenCalledWith({
        where: {
          id: expect.anything(),
          shipment: { id: mockShipment.id },
        },
      });
      expect(mockShipmentsRepository.save).toHaveBeenCalledWith({
        ...mockShipment,
        currentStatus: 13,
        dateTimeCurrentStatus: expect.any(Date),
      });
      expect(mockTransactionLogsService.createLog).toHaveBeenCalled();
    });

    it('should handle precheck with multiple fields', async () => {
      const precheckReportData = {
        codeGen: 'TEST-CODE-123',
        reportType: InconsistencyType.PRECHECK,
        license: '987654321',
        trailerPlate: 'TRAILER123',
        truckPlate: 'TRUCK456',
        comments: 'Multiple fields inconsistency',
        userId: 1,
      };

      mockDataInconsistencyRepository.findOne.mockResolvedValue(null);

      const mockCreatedReport = {
        id: 1,
        shipment: mockShipment,
        user: mockUser,
        inconsistencyType: JSON.stringify({
          precheck: {
            license: precheckReportData.license,
            trailerPlate: precheckReportData.trailerPlate,
            truckPlate: precheckReportData.truckPlate,
            reportedAt: expect.any(String),
            reportedBy: mockUser.username,
          },
        }),
        comments: precheckReportData.comments,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDataInconsistencyRepository.create.mockReturnValue(mockCreatedReport);
      mockDataInconsistencyRepository.save.mockResolvedValue(mockCreatedReport);

      const result = await service.reportInconsistency(precheckReportData);

      expect(result).toBeDefined();
      expect(mockTransactionLogsService.createLog).toHaveBeenCalled();
    });

    it('should throw NotFoundException when shipment not found', async () => {
      mockShipmentsRepository.findOne.mockResolvedValue(null);

      await expect(service.reportInconsistency(mockReportData)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTransactionLogsService.createLog).toHaveBeenCalledWith({
        code_gen: mockReportData.codeGen,
        json_enviado: JSON.stringify(mockReportData),
        usuario: 'UNKNOWN',
        estatus: 'UNKNOWN',
        motivo_invalidacion: expect.stringContaining('no encontrado'),
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.reportInconsistency(mockReportData)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTransactionLogsService.createLog).toHaveBeenCalledWith({
        code_gen: mockReportData.codeGen,
        json_enviado: JSON.stringify(mockReportData),
        usuario: 'UNKNOWN',
        estatus: mockShipment.currentStatus.toString(),
        motivo_invalidacion: expect.stringContaining('no encontrado'),
      });
    });

    it('should throw NotFoundException when predefined status 13 not found', async () => {
      mockPredefinedStatusesRepository.findOne.mockResolvedValue(null);

      await expect(service.reportInconsistency(mockReportData)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTransactionLogsService.createLog).toHaveBeenCalledWith({
        code_gen: mockReportData.codeGen,
        json_enviado: JSON.stringify(mockReportData),
        usuario: mockUser.username,
        estatus: mockShipment.currentStatus.toString(),
        motivo_invalidacion: expect.stringContaining('Estado predefinido'),
      });
    });

    it('should throw BadRequestException when no inconsistent data provided for precheck', async () => {
      const invalidReportData = {
        codeGen: 'TEST-CODE-123',
        reportType: InconsistencyType.PRECHECK,
        comments: 'Test comment',
        userId: 1,
        // No license, trailerPlate, or truckPlate
      };

      await expect(
        service.reportInconsistency(invalidReportData),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionLogsService.createLog).toHaveBeenCalledWith({
        code_gen: invalidReportData.codeGen,
        json_enviado: JSON.stringify(invalidReportData),
        usuario: mockUser.username,
        estatus: mockShipment.currentStatus.toString(),
        motivo_invalidacion: expect.stringContaining('proporcionar al menos'),
      });
    });

    it('should throw BadRequestException when no sealIds provided for seals report', async () => {
      const invalidReportData = {
        codeGen: 'TEST-CODE-123',
        reportType: InconsistencyType.SEALS,
        comments: 'Test comment',
        userId: 1,
        // No sealIds array
      };

      await expect(
        service.reportInconsistency(invalidReportData),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionLogsService.createLog).toHaveBeenCalledWith({
        code_gen: invalidReportData.codeGen,
        json_enviado: JSON.stringify(invalidReportData),
        usuario: mockUser.username,
        estatus: mockShipment.currentStatus.toString(),
        motivo_invalidacion: expect.stringContaining(
          'proporcionar al menos un ID de seal',
        ),
      });
    });

    it('should throw BadRequestException when some seal IDs do not exist', async () => {
      const sealsReportData = {
        codeGen: 'TEST-CODE-123',
        reportType: InconsistencyType.SEALS,
        comments: 'Seals inconsistency',
        userId: 1,
        sealIds: [1, 2, 999], // 999 doesn't exist
      };

      const mockSeals = [
        { id: 1, sealCode: 'SEAL001', shipment: mockShipment },
        { id: 2, sealCode: 'SEAL002', shipment: mockShipment },
        // Missing seal with id: 999
      ];

      mockShipmentSealsRepository.find.mockResolvedValue(mockSeals);

      await expect(
        service.reportInconsistency(sealsReportData),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionLogsService.createLog).toHaveBeenCalledWith({
        code_gen: sealsReportData.codeGen,
        json_enviado: JSON.stringify(sealsReportData),
        usuario: mockUser.username,
        estatus: mockShipment.currentStatus.toString(),
        motivo_invalidacion: expect.stringContaining(
          'Algunos IDs de seals no existen',
        ),
      });
    });

    it('should handle status repository save error gracefully', async () => {
      mockDataInconsistencyRepository.findOne.mockResolvedValue(null);
      mockStatusRepository.save.mockRejectedValue(
        new Error('Status save error'),
      );

      const mockCreatedReport = {
        id: 1,
        shipment: mockShipment,
        user: mockUser,
        inconsistencyType: JSON.stringify({
          precheck: {
            license: mockReportData.license,
            trailerPlate: undefined,
            truckPlate: undefined,
            reportedAt: expect.any(String),
            reportedBy: mockUser.username,
          },
        }),
        comments: mockReportData.comments,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDataInconsistencyRepository.create.mockReturnValue(mockCreatedReport);
      mockDataInconsistencyRepository.save.mockResolvedValue(mockCreatedReport);

      // Should not throw error even if status save fails
      const result = await service.reportInconsistency(mockReportData);

      expect(result).toBeDefined();
      expect(mockTransactionLogsService.createLog).toHaveBeenCalled();
    });

    it('should log error for unhandled exceptions', async () => {
      const unexpectedError = new Error('Unexpected database error');
      mockDataInconsistencyRepository.save.mockRejectedValue(unexpectedError);
      mockDataInconsistencyRepository.findOne.mockResolvedValue(null);
      mockDataInconsistencyRepository.create.mockReturnValue({});

      await expect(service.reportInconsistency(mockReportData)).rejects.toThrow(
        unexpectedError,
      );
      expect(mockTransactionLogsService.createLog).toHaveBeenCalledWith({
        code_gen: mockReportData.codeGen,
        json_enviado: JSON.stringify(mockReportData),
        usuario: mockUser.username,
        estatus: mockShipment.currentStatus.toString(),
        motivo_invalidacion: unexpectedError.message,
      });
    });
  });

  describe('getInconsistencyByShipment', () => {
    it('should return inconsistency report for existing shipment', async () => {
      const mockShipment = { id: 1, codeGen: 'TEST-CODE' };
      const mockReport = {
        id: 1,
        shipment: mockShipment,
        user: { id: 1, username: 'testuser' },
        inconsistencyType: '{"precheck": {"license": "123"}}',
        comments: 'Test comment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockShipmentsRepository.findOne.mockResolvedValue(mockShipment);
      mockDataInconsistencyRepository.findOne.mockResolvedValue(mockReport);

      const result = await service.getInconsistencyByShipment('TEST-CODE');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('shipmentCodeGen', 'TEST-CODE');
      expect(result).toHaveProperty('userName', 'testuser');
    });

    it('should return message when no report exists', async () => {
      const mockShipment = { id: 1, codeGen: 'TEST-CODE' };

      mockShipmentsRepository.findOne.mockResolvedValue(mockShipment);
      mockDataInconsistencyRepository.findOne.mockResolvedValue(null);

      const result = await service.getInconsistencyByShipment('TEST-CODE');

      expect(result).toEqual({
        message: 'Envío sin inconsistencias encontradas actualmente',
        codeGen: 'TEST-CODE',
        statusCode: 200,
      });
    });

    it('should throw NotFoundException when shipment not found', async () => {
      mockShipmentsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getInconsistencyByShipment('INVALID-CODE'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllInconsistencies', () => {
    it('should return paginated inconsistencies without filters', async () => {
      const mockReports = [
        {
          id: 1,
          shipment: { id: 1, codeGen: 'CODE1' },
          user: { id: 1, username: 'user1' },
          inconsistencyType: '{"precheck": {"license": "123"}}',
          comments: 'Comment 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDataInconsistencyRepository.findAndCount.mockResolvedValue([
        mockReports,
        1,
      ]);

      const result = await service.getAllInconsistencies(1, 20);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.count).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.offset).toBe(0);
      expect(mockDataInconsistencyRepository.findAndCount).toHaveBeenCalledWith(
        {
          where: {},
          relations: ['shipment', 'user'],
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        },
      );
    });

    it('should return filtered inconsistencies by date range', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const mockReports = [];
      mockDataInconsistencyRepository.findAndCount.mockResolvedValue([
        mockReports,
        0,
      ]);

      const result = await service.getAllInconsistencies(1, 20, filters);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(0);
      expect(mockDataInconsistencyRepository.findAndCount).toHaveBeenCalledWith(
        {
          where: {
            createdAt: expect.any(Object), // Between condition
          },
          relations: ['shipment', 'user'],
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        },
      );
    });

    it('should filter by report type after query', async () => {
      const filters = {
        reportType: InconsistencyType.PRECHECK,
      };

      const mockReports = [
        {
          id: 1,
          shipment: { id: 1, codeGen: 'CODE1' },
          user: { id: 1, username: 'user1' },
          inconsistencyType: '{"precheck": {"license": "123"}}',
          comments: 'Comment 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          shipment: { id: 2, codeGen: 'CODE2' },
          user: { id: 1, username: 'user1' },
          inconsistencyType:
            '{"seals": {"sealIds": [1], "seals": [{"id": 1, "sealCode": "SEAL001"}]}}',
          comments: 'Comment 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDataInconsistencyRepository.findAndCount.mockResolvedValue([
        mockReports,
        2,
      ]);

      const result = await service.getAllInconsistencies(1, 20, filters);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1); // Only PRECHECK should be returned
      expect(result.data[0].parsedInconsistencyData.precheck).toBeDefined();
    });

    it('should filter by seals report type', async () => {
      const filters = {
        reportType: InconsistencyType.SEALS,
      };

      const mockReports = [
        {
          id: 1,
          shipment: { id: 1, codeGen: 'CODE1' },
          user: { id: 1, username: 'user1' },
          inconsistencyType: '{"precheck": {"license": "123"}}',
          comments: 'Comment 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          shipment: { id: 2, codeGen: 'CODE2' },
          user: { id: 1, username: 'user1' },
          inconsistencyType:
            '{"seals": {"sealIds": [1], "seals": [{"id": 1, "sealCode": "SEAL001"}]}}',
          comments: 'Comment 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDataInconsistencyRepository.findAndCount.mockResolvedValue([
        mockReports,
        2,
      ]);

      const result = await service.getAllInconsistencies(1, 20, filters);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1); // Only SEALS should be returned
      expect(result.data[0].parsedInconsistencyData.seals).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      const mockReports = [];
      mockDataInconsistencyRepository.findAndCount.mockResolvedValue([
        mockReports,
        0,
      ]);

      const result = await service.getAllInconsistencies(3, 10);

      expect(mockDataInconsistencyRepository.findAndCount).toHaveBeenCalledWith(
        {
          where: {},
          relations: ['shipment', 'user'],
          order: { createdAt: 'DESC' },
          skip: 20, // (3-1) * 10
          take: 10,
        },
      );
      expect(result.pagination.offset).toBe(20);
      expect(result.pagination.limit).toBe(10);
    });
  });

  describe('getSealsByShipment', () => {
    it('should return seals for a shipment', async () => {
      const mockSeals = [
        { id: 1, sealCode: 'SEAL001', createdAt: new Date('2024-01-01') },
        { id: 2, sealCode: 'SEAL002', createdAt: new Date('2024-01-02') },
      ];

      mockShipmentSealsRepository.find.mockResolvedValue(mockSeals);

      const result = await service.getSealsByShipment(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, sealCode: 'SEAL001' });
      expect(result[1]).toEqual({ id: 2, sealCode: 'SEAL002' });
      expect(mockShipmentSealsRepository.find).toHaveBeenCalledWith({
        where: { shipment: { id: 1 } },
        order: { createdAt: 'ASC' },
      });
    });

    it('should return empty array when no seals found', async () => {
      mockShipmentSealsRepository.find.mockResolvedValue([]);

      const result = await service.getSealsByShipment(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('getTransactionLogsByCodeGen', () => {
    it('should return transaction logs for a code gen', async () => {
      const mockLogs = [
        {
          id: 1,
          code_gen: 'TEST-CODE',
          usuario: 'testuser',
          estatus: '13',
          createdAt: new Date(),
        },
      ];

      mockTransactionLogsService.getLogsByCodeGen.mockResolvedValue(mockLogs);

      const result = await service.getTransactionLogsByCodeGen('TEST-CODE');

      expect(result).toBe(mockLogs);
      expect(mockTransactionLogsService.getLogsByCodeGen).toHaveBeenCalledWith(
        'TEST-CODE',
      );
    });
  });

  describe('getTransactionLogsByDateRange', () => {
    it('should return transaction logs for a date range', async () => {
      const mockLogs = [
        {
          id: 1,
          code_gen: 'TEST-CODE',
          usuario: 'testuser',
          estatus: '13',
          createdAt: new Date(),
        },
      ];

      mockTransactionLogsService.getLogsByDateRange.mockResolvedValue(mockLogs);

      const result = await service.getTransactionLogsByDateRange(
        '2024-01-01',
        '2024-01-31',
      );

      expect(result).toBe(mockLogs);
      expect(
        mockTransactionLogsService.getLogsByDateRange,
      ).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
    });
  });
});
