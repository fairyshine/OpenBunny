import { Command } from 'commander';
import chalk from 'chalk';
import Conf from 'conf';

const store = new Conf({ projectName: 'openbunny' });

export const configCommand = new Command('config')
  .description('Manage configuration');

configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key (e.g., apiKey, model, provider)')
  .argument('<value>', 'Configuration value')
  .action((key: string, value: string) => {
    store.set(key, value);
    console.log(chalk.green(`✓ Set ${key} = ${value}`));
  });

configCommand
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .action((key: string) => {
    const value = store.get(key);
    if (value === undefined) {
      console.log(chalk.yellow(`Key "${key}" not found`));
    } else {
      console.log(chalk.cyan(`${key} = ${value}`));
    }
  });

configCommand
  .command('list')
  .description('List all configuration')
  .action(() => {
    const config = store.store;
    if (Object.keys(config).length === 0) {
      console.log(chalk.gray('No configuration set'));
    } else {
      console.log(chalk.cyan('Configuration:'));
      for (const [key, value] of Object.entries(config)) {
        // Mask API keys
        const displayValue = key.toLowerCase().includes('key') || key.toLowerCase().includes('apikey')
          ? String(value).slice(0, 8) + '...'
          : value;
        console.log(`  ${chalk.gray(key)}: ${displayValue}`);
      }
    }
  });

configCommand
  .command('delete')
  .description('Delete a configuration value')
  .argument('<key>', 'Configuration key')
  .action((key: string) => {
    store.delete(key);
    console.log(chalk.green(`✓ Deleted ${key}`));
  });

configCommand
  .command('clear')
  .description('Clear all configuration')
  .action(() => {
    store.clear();
    console.log(chalk.green('✓ Configuration cleared'));
  });
