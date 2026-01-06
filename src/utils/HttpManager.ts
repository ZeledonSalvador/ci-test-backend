import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AxiosRequestConfig, AxiosResponse } from 'axios';

@Injectable()
export class HttpManager {
  constructor(private readonly httpService: HttpService) {}

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await lastValueFrom(
        this.httpService.get<T>(url, config),
      );
      this.formatHttpResponse(response, false, url); // No es error
      return response.data;
    } catch (error) {
      this.formatHttpResponse(error.response, true, url); // Es un error
      throw new HttpException(
        error.response?.data || 'Network Server Error',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async post<T>(
    url: string,
    data: any = {},
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await lastValueFrom(
        this.httpService.post<T>(url, data, config),
      );
      this.formatHttpResponse(response, false, url); // No es error
      return response.data;
    } catch (error) {
      this.formatHttpResponse(error.response, true, url); // Es un error
      throw new HttpException(
        error.response?.data || 'Network Server Error',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async put<T>(
    url: string,
    data: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    try {
      const response: AxiosResponse<T> = await lastValueFrom(
        this.httpService.put<T>(url, data, config),
      );
      this.formatHttpResponse(response, false, url); // No es error
      return response;
    } catch (error) {
      this.formatHttpResponse(error.response, true, url); // Es un error
      throw new HttpException(
        error.response?.data || 'An error occurred',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await lastValueFrom(
        this.httpService.delete<T>(url, config),
      );
      this.formatHttpResponse(response, false, url); // No es error
      return response.data;
    } catch (error) {
      this.formatHttpResponse(error.response, true, url); // Es un error
      throw new HttpException(
        'Network or server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private formatHttpResponse(
    response: AxiosResponse | null,
    isError: boolean,
    url: string,
  ): void {
    // Logs desactivados para optimización de memoria
    // Solo logear en caso de error
    if (isError && response?.status) {
      console.error(`[HTTP ERROR] ${response.status} - ${url}`);
    }
  }
}
