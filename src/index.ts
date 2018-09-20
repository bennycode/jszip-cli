import {BuildService} from './BuildService';
import {ExtractService} from './ExtractService';
import {CLIOptions} from './Interfaces';
import * as fs from 'fs-extra';
import * as logdown from 'logdown';
import * as path from 'path';

const defaultOptions: Required<CLIOptions> = {
  compressionLevel: 5,
  configFile: true,
  dereferenceLinks: false,
  force: false,
  ignoreEntries: [],
  outputEntry: null,
  quiet: false,
  verbose: false,
};

export class JSZipCLI {
  private readonly buildService: BuildService;
  private readonly extractService: ExtractService;
  private readonly logger: logdown.Logger;
  private mode?: string;
  private options: Required<CLIOptions>;
  private rawEntries?: string[];

  constructor(options: CLIOptions = defaultOptions) {
    this.options = {...defaultOptions, ...options};
    this.logger = logdown('jszip-cli/index', {
      logger: console,
      markdown: false,
    });
    this.logger.state = {isEnabled: this.options.verbose};

    if (typeof this.options.configFile === 'string') {
      console.log('config file is a string');
      this.readConfigFile();
    } else if (this.options.configFile === true) {
      this.options.configFile = '.jsziprc.json';
      this.readConfigFile(true);
    } else {
      this.logger.info('Not using any configuration file.');
    }

    this.buildService = new BuildService(this.options);
    this.extractService = new ExtractService(this.options);
  }

  private readConfigFile(loose = false): void {
    const resolvedDir = path.resolve(this.options.configFile as string);
    this.options.configFile = resolvedDir;
    try {
      fs.accessSync(resolvedDir, fs.constants.F_OK | fs.constants.R_OK);
    } catch (error) {
      if (!loose) {
        throw new Error(`Can't read configuration file "${resolvedDir}".`);
      }
      this.logger.info('Not using any configuration file (default configuration file not found).');
      return;
    }

    this.logger.info(`Using configuration file "${resolvedDir}".`);

    try {
      const configFileData = require(resolvedDir);
      console.log(configFileData);
      if (configFileData.entries) {
        this.rawEntries = configFileData.entries;
        delete configFileData.entries;
      }
      if (configFileData.mode) {
        this.mode = configFileData.mode;
        delete configFileData.mode;
      }
      this.options = {...this.options, ...configFileData};
      return;
    } catch (error) {
      throw new Error(`Malformed JSON configuration file "${resolvedDir}".`);
    }
  }

  public add(rawEntries?: string[]): BuildService {
    if (!rawEntries) {
      if (this.rawEntries) {
        rawEntries = this.rawEntries;
      } else {
        throw new Error('No entries to add.');
      }
    }
    return this.buildService.add(rawEntries);
  }

  public extract(rawEntries?: string[]): Promise<ExtractService> {
    if (!rawEntries) {
      if (this.rawEntries) {
        rawEntries = this.rawEntries;
      } else {
        throw new Error('No entries to extract.');
      }
    }
    return this.extractService.extract(rawEntries);
  }

  public async fileMode(): Promise<void> {
    if (this.mode === 'add') {
      await this.add()
        .save()
        .then(({outputFile, compressedFilesCount}) => {
          if (this.options.outputEntry && !this.options.quiet) {
            console.log(`Done compressing ${compressedFilesCount} files to "${outputFile}".`);
          }
        });
      return;
    } else if (this.mode === 'extract') {
      await this.extract().then(({outputDir, extractedFilesCount}) => {
        if (this.options.outputEntry && !this.options.quiet) {
          console.log(`Done extracting ${extractedFilesCount} files to "${outputDir}".`);
        }
      });
      return;
    } else {
      throw new Error('No mode in configuration file defined.');
    }
  }

  public save(): Promise<BuildService> {
    return this.buildService.save();
  }
}
