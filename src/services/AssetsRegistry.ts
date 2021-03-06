import fs from "fs-extra";
import path from "path";
import { Service, Inject } from "typedi";
import { Environment } from "../installer/services/Environment";
import { Artifact, Script } from "../types/manifest";
import { AssetManifestManager } from "../installer/services/AssetsManifest";
import { ArtifactsDownloader } from "../installer/services/ArtifactDownloader";
import { ProgressCallback } from "../types/progress";

/**
 * Asset registry.
 *
 * The asset registry service takes care of creating, adding and downloading artifacts and
 * scripts for the installer manifest.
 *
 * @export
 * @class AssetRegistry
 */
@Service()
export class AssetRegistry {
    /**
     * Inject environment.
     *
     * @private
     * @type {Environment}
     * @memberof InstallerConfigurator
     */
    @Inject()
    private env!: Environment;

    /**
     * Injects asset manifest mananger.
     *
     * @private
     * @type {AssetManifestManager}
     * @memberof AssetRegistry
     */
    @Inject()
    private manifest!: AssetManifestManager;

    /**
     * Injected artifact downloader.
     *
     * @private
     * @type {ArtifactsDownloader}
     * @memberof AssetRegistry
     */
    @Inject()
    private downloader!: ArtifactsDownloader;

    /**
     * Initilizes the asset directory.
     *
     * If the directory already exists it will clear it and then initilize it.
     * All previously stored data there will be lost.
     *
     * @memberof AssetRegistry
     */
    public initAssetsDirectory(): void {
        if (fs.pathExistsSync(this.env.assetsDirectory) === false) {
            this.createAssetsDirectory();
        } else {
            this.clearAssetsDirectory();
            this.createAssetsDirectory();
        }
    }

    /**
     * Saves the asset registries coresponding manifest.
     *
     * @memberof AssetRegistry
     */
    public saveManifest(): void {
        this.manifest.save(this.env.assetsManifestPath);
    }

    /**
     * Adds a given artifact to the asset registry.
     *
     * @param {Artifact} artifact Artifact to add
     * @param {boolean} [download] Flag, whether the artifact should be downloaded now for a offline installer
     * @returns {Promise<void>}
     * @memberof AssetRegistry
     */
    public async addArtifact(artifact: Artifact, download?: boolean, progress?: ProgressCallback): Promise<void> {
        if (download && artifact.url) {
            artifact.path = await this.downloader.download(`${artifact.package}-${artifact.arch}`, artifact.url, download, progress);
            artifact.path = artifact.path.replace(path.normalize(this.env.assetsDirectory), ".");

            if (download && artifact.adds) {
                for (let i = 0; i < artifact.adds.length; i++) {
                    let add = artifact.adds[i];

                    add.path = await this.downloader.download(`${artifact.package}-${artifact.arch}-add${i}`, add.url, download, progress);
                    add.path = add.path.replace(path.normalize(this.env.assetsDirectory), ".");

                    artifact.adds[i] = add;
                }
            }
        }

        this.manifest.addArtifact(artifact);
    }

    /**
     * Addsa a given post install script.
     *
     * @param {Script} script Script to add
     * @memberof AssetRegistry
     */
    public addScript(script: Script): void {
        if (fs.existsSync(script.path)) {
            const basepath = path.join(this.env.assetsScriptsDirectory, script.package);
            const filename = path.join(basepath, path.basename(script.path));
            fs.copyFileSync(script.path, filename);

            script.path = filename.replace(path.normalize(this.env.assetsDirectory), ".");
            this.manifest.addScripts(script);
        }
    }

    /**
     * Creates a new asset directory with all it's parent directories.
     *
     * ./assets
     * - ./assets/artifacts
     * - ./assets/scripts
     *
     * @private
     * @memberof AssetRegistry
     */
    private createAssetsDirectory(): void {
        fs.mkdirSync(this.env.assetsDirectory);
        fs.mkdirSync(this.env.assetsArtifactsDirectory);
        fs.mkdirSync(this.env.assetsScriptsDirectory);
    }

    /**
     * Clears the current asset directory.
     *
     * All data previously stored in there will be lost.
     *
     * @memberof AssetRegistry
     */
    private clearAssetsDirectory(): void {
        this.clearDirectory(this.env.assetsArtifactsDirectory);
        this.clearDirectory(this.env.assetsScriptsDirectory);
        this.clearDirectory(this.env.assetsDirectory);
    }

    /**
     * Clears the directory for a given path.
     *
     * @private
     * @param {string} directoryPath Directory path for the directory to clear
     * @memberof AssetRegistry
     */
    private clearDirectory(directoryPath: string): void {
        if (fs.existsSync(directoryPath)) {
            fs.readdirSync(directoryPath)
                .filter((c) => path.extname(c) !== "")
                .map((c) => path.join(directoryPath, c))
                .forEach((c) => fs.unlinkSync(c));

            fs.rmdirSync(directoryPath, {
                recursive: true,
            });
        }
    }
}
