import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'src/models/Queue';
import { Shipments } from 'src/models/Shipments';
import { TipoCamion } from 'src/modules/shipments/enums/tipoCamion.enum';
import { StatusService } from 'src/modules/status/services/status.service';
import { Repository } from 'typeorm';

@Injectable()
export class QueueService {
  //private readonly maxCalled = 4; // Máximo número de registros con estado "waiting_to_send"

  constructor(
    @InjectRepository(Queue)
    private readonly queueRepository: Repository<Queue>,
    @InjectRepository(Shipments)
    private readonly shipmentsRepository: Repository<Shipments>,
    private readonly statusService: StatusService
  ) { }


  /**
  * Llama un cupo de un tipo específico creando un registro con estado "waiting_to_send".
  * Valida que no existan más de 4 registros en total con estado "waiting_to_send".
  * @param type El tipo de cupo (por ejemplo, "volteo", "plano").
  */
    async callQueue(type: string): Promise<Queue> 
    {
      if (!Object.values(TipoCamion).includes(type as TipoCamion)) 
      {
        throw new BadRequestException('Tipo de camión inválido.');
      }

      // Contar los registros con estado "waiting_to_send" SOLO de ese tipo
      const currentCount = await this.queueRepository.count({
        where: { type, status: 'waiting_to_send' },
      });

      // Lógica dinámica del límite
      const maxAllowed = type === TipoCamion.PIPA ? 5 : 4;

      if (currentCount >= maxAllowed) 
      {
        throw new BadRequestException(
          `No se pueden llamar más cupos para el tipo "${type}". Límite de ${maxAllowed} alcanzado.`,
        );
      }

      // Crear un nuevo registro en la cola con estado "waiting_to_send"
      const newQueue = this.queueRepository.create({
        type,
        status: 'waiting_to_send',
        shipmentCodeGen: null,
      });

      return await this.queueRepository.save(newQueue);
    }



  /**
   * Envía un shipment asignándolo a un cupo disponible y cambia el estado a "sended".
   */
  async sendShipment(
    codeGen: string,
    observationsChangeStatus?: string,
    leveransUsernameChangeStatus?: string
  ): Promise<Queue> {
    // Buscar el shipment por su código de generación
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
      relations: [
        "vehicle"
      ]
    });


    if (!shipment) {
      throw new BadRequestException(`Shipment con código "${codeGen}" no encontrado.`);
    }


    console.log(
      "esto es la data: ",
      await this.statusService.getLastStatusByCodeGen(shipment.codeGen)
    );

    if ((await this.statusService.getLastStatusByCodeGen(shipment.codeGen)).id >= 4) {
      throw new BadRequestException("No puede llamar a un envio que ya tiene un status mayor a 4 (trassacion autorizada)");
    }



    // Determinar el tipo de carga del shipment
    const shipmentType = shipment.vehicle.truckType;

    // Buscar un cupo disponible con estado "waiting_to_send" y el tipo correspondiente
    const availableQueue = await this.queueRepository.findOne({
      where: { type: shipmentType, status: 'waiting_to_send' },
    });

    if (!availableQueue) {
      throw new BadRequestException(`No hay cupos disponibles para el tipo "${shipmentType}".`);
    }



    // Asignar el shipment al cupo y cambiar el estado a "sended"
    availableQueue.status = 'sended';
    availableQueue.shipmentCodeGen = shipment;

    /* 
      AL llamarse significa que el shitpment pasa 
      a un nuevo estado a 4 (Ingreso autorizado)
    */
    this.statusService.updateStatusesForShipment(
      shipment.codeGen,
      4,
      observationsChangeStatus,
      leveransUsernameChangeStatus
    );
    return await this.queueRepository.save(availableQueue);
  }

  /**
 * Obtiene el número de cupos disponibles por tipo, es decir,
 * cuántos registros con estado "waiting_to_send" hay por tipo.
 * @param type El tipo de cupo (por ejemplo, "volteo", "plano").
 * @returns Un objeto con el estado y los cupos disponibles.
 */
  async getAvailableSlotsByType(type: string): Promise<{ data: number }> {
    if (!Object.values(TipoCamion).includes(type as TipoCamion)) {
      throw new BadRequestException('Tipo de camión inválido.');
    }

    // Contar los registros con estado "waiting_to_send" para el tipo específico
    const availableCount = await this.queueRepository.count({
      where: { type, status: 'waiting_to_send' },
    });

    // Retornar en formato JSON con status y data
    return {
      data: availableCount, // Número de cupos disponibles para ese tipo
    };
  }

  async getAvailableSlotsForAllTypes(): Promise<{ data: { [type: string]: number } }> {
    // Obtener todos los tipos posibles definidos en el enum TipoCamion
    const allTypes = Object.values(TipoCamion);

    // Crear un objeto donde almacenaremos los resultados
    const availableSlotsByType: { [type: string]: number } = {};

    // Iterar sobre todos los tipos definidos en el enum
    for (const type of allTypes) {
      // Contar los registros con estado "waiting_to_send" para el tipo específico
      const availableCount = await this.queueRepository.count({
        where: { type, status: 'waiting_to_send' },
      });

      // Si no hay registros, el contador será 0
      availableSlotsByType[type] = availableCount;
    }
    return {
      data: availableSlotsByType, // Objeto con el número de cupos disponibles por tipo
    };


  }


  /**
 * Libera un cupo eliminando un registro del tipo especificado con estado "waiting_to_send".
 * Si no hay cupos disponibles para liberar, lanza una excepción.
 * 
 * @param type El tipo de cupo (por ejemplo, "volteo", "plano").
 */
  async releaseSlot(type: string): Promise<{ message: string }> {
    // Verificar que el tipo es válido
    if (!Object.values(TipoCamion).includes(type as TipoCamion)) {
      throw new BadRequestException('Tipo de camión inválido.');
    }

    // Buscar el cupo más antiguo con estado "waiting_to_send" para el tipo especificado
    const slotToRelease = await this.queueRepository.findOne({
      where: { type, status: 'waiting_to_send' },
      order: { entryTime: 'ASC' },
    });

    // Si no se encuentra ningún cupo disponible para liberar, lanzar excepción
    if (!slotToRelease) {
      throw new BadRequestException(`No hay cupos disponibles para liberar del tipo "${type}".`);
    }

    // Eliminar el registro encontrado
    await this.queueRepository.remove(slotToRelease);

    return { message: `Cupo del tipo "${type}" liberado correctamente.` };
  }

  /**
 * Libera múltiples cupos del tipo especificado con estado "waiting_to_send".
 * 
 * @param type El tipo de cupo (por ejemplo, "volteo", "plano").
 * @param quantity La cantidad de cupos a liberar.
 */
  async releaseMultipleSlots(type: string, quantity: number): Promise<{ released: number }> {
    // Verificar que el tipo es válido
    if (!Object.values(TipoCamion).includes(type as TipoCamion)) {
      throw new BadRequestException('Tipo de camión inválido.');
    }

    // Buscar los registros más antiguos con estado "waiting_to_send" y el tipo especificado
    const slotsToRelease = await this.queueRepository.find({
      where: { type, status: 'waiting_to_send' },
      order: { entryTime: 'ASC' }, // Asegura liberar los más antiguos
      take: quantity, // Limita a la cantidad solicitada
    });

    // Verificar si hay suficientes registros para liberar
    if (slotsToRelease.length < quantity) {
      throw new BadRequestException(
        `No hay suficientes cupos disponibles para liberar del tipo "${type}". Solo hay ${slotsToRelease.length} cupos disponibles.`
      );
    }

    // Eliminar los registros encontrados
    await this.queueRepository.remove(slotsToRelease);

    return { released: slotsToRelease.length };
  }


}
